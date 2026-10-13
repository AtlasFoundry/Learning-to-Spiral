import {
  restoreLibrary,
  safeUrl,
  type Lesson,
  type Library,
  type Source,
  type Visual,
} from "./library";

export const maxPackBytes = 10 * 1024 * 1024;
type PackRecord =
  | { kind: "lessons"; record: Lesson }
  | { kind: "sources"; record: Source }
  | { kind: "visuals"; record: Visual };
export type PackEntry = PackRecord & { key: string; reviewReason?: string };
export type PackIssue = { title: string; id: string; reason: string };
export type PackPreview = { entries: PackEntry[]; skipped: PackIssue[] };
const fields = {
  lessons: ["id", "title", "pillarId", "summary", "content", "notes"],
  sources: [
    "id",
    "title",
    "author",
    "year",
    "type",
    "url",
    "reference",
    "findings",
    "notes",
    "status",
    "lessonIds",
    "attachmentIds",
  ],
  visuals: [
    "id",
    "title",
    "description",
    "concept",
    "placement",
    "status",
    "notes",
    "url",
    "attachmentId",
    "lessonIds",
  ],
} as const;
const normalized = (text: string) =>
  text.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();

export async function previewLessonPack(
  input: string,
  library: Library,
): Promise<PackPreview> {
  if (new Blob([input]).size > maxPackBytes)
    throw new Error("Lesson packs must be 10 MB or smaller.");
  let pack;
  try {
    pack = JSON.parse(input.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("Malformed lesson-pack JSON. Nothing has been added.");
  }
  if (
    !pack ||
    pack.kind !== "learning-to-spiral-additive-lesson-pack" ||
    pack.schemaVersion !== 1 ||
    pack.studioSchemaVersion !== 1
  )
    throw new Error(
      "Choose an additive lesson pack, not a lesson update or portable backup.",
    );
  if (
    !Array.isArray(pack.quotes) ||
    pack.quotes.length ||
    !Array.isArray(pack.attachments) ||
    pack.attachments.length
  )
    throw new Error(
      "This lesson-pack importer supports lessons, sources and visual briefs only. Quotes and attachments must be empty; upload files in their library editors.",
    );
  for (const collection of ["lessons", "sources", "visuals"] as const) {
    if (!Array.isArray(pack[collection]) || pack[collection].length > 1000)
      throw new Error(
        `${collection} must be an array of at most 1,000 records.`,
      );
    for (const record of pack[collection]) {
      if (
        !record ||
        typeof record !== "object" ||
        Array.isArray(record) ||
        Object.keys(record).some(
          (key) => !(fields[collection] as readonly string[]).includes(key),
        )
      )
        throw new Error(
          `${collection} contains an invalid record or unsupported fields. Nothing has been added.`,
        );
      if (typeof record.title !== "string" || !record.title.trim())
        throw new Error(`${collection}: each record needs a title.`);
      if (
        record.url &&
        (typeof record.url !== "string" ||
          !safeUrl(record.url) ||
          (collection === "visuals" && !/^https?:\/\//i.test(record.url)))
      )
        throw new Error(
          `${collection}: use an http/https URL${collection === "sources" ? " or DOI" : ""}.`,
        );
    }
  }
  if (
    pack.lessonCount !== undefined &&
    pack.lessonCount !== pack.lessons.length
  )
    throw new Error("The lesson count does not match the pack.");
  if (
    pack.sources.some(
      (source: Source) =>
        !Array.isArray(source.attachmentIds) || source.attachmentIds.length,
    ) ||
    pack.visuals.some((visual: Visual) => visual.attachmentId !== "")
  )
    throw new Error(
      "A visual brief or source cannot claim an attachment that is not in this pack.",
    );
  // Validate only in memory. Pack metadata never replaces pillar context or controls merging.
  let validated: Library;
  try {
    validated = await restoreLibrary(
      JSON.stringify({
        version: 1,
        pillarNamesVersion: 1,
        pillars: library.pillars,
        lessons: pack.lessons,
        sources: pack.sources,
        visuals: pack.visuals,
        quotes: [],
        attachments: [],
      }),
    );
  } catch {
    throw new Error(
      "The pack has invalid fields, duplicate IDs, pillar IDs, statuses or lesson links. Nothing has been added.",
    );
  }
  const entries: PackEntry[] = [];
  const skipped: PackIssue[] = [];
  const titles = new Map(
    library.lessons.map((lesson) => [normalized(lesson.title), lesson.title]),
  );
  for (const record of validated.lessons) {
    if (library.lessons.some((lesson) => lesson.id === record.id)) {
      skipped.push({
        id: record.id,
        title: record.title,
        reason: "This lesson ID already exists. Its content is preserved.",
      });
      continue;
    }
    const duplicateTitle = titles.get(normalized(record.title));
    const mentioned = library.lessons.find(
      (lesson) =>
        normalized(lesson.title).length >= 8 &&
        normalized(record.notes).includes(normalized(lesson.title)),
    );
    const reviewReason = duplicateTitle
      ? `A lesson titled “${duplicateTitle}” already exists. Review its teaching role before adding another.`
      : mentioned
        ? `The draft's notes mention your existing lesson “${mentioned.title}”. Review the possible overlap before adding.`
        : undefined;
    entries.push({
      kind: "lessons",
      key: `lessons:${record.id}`,
      record,
      reviewReason,
    });
    titles.set(normalized(record.title), record.title);
  }
  const availableIds = new Set(
    entries
      .filter((entry) => entry.kind === "lessons")
      .map((entry) => entry.record.id),
  );
  for (const kind of ["sources", "visuals"] as const) {
    const masterTitles = new Set(
      library[kind].map((record) => normalized(record.title)),
    );
    for (const record of validated[kind]) {
      if (library[kind].some((existing) => existing.id === record.id)) {
        skipped.push({
          id: record.id,
          title: record.title,
          reason: `This ${kind === "sources" ? "source" : "visual"} ID already exists. Its contents and links are preserved.`,
        });
        continue;
      }
      if (!record.lessonIds.some((id) => availableIds.has(id))) {
        skipped.push({
          id: record.id,
          title: record.title,
          reason: "No new lesson in this preview uses this record.",
        });
        continue;
      }
      const reviewReason = masterTitles.has(normalized(record.title))
        ? "A library record with this title already exists. Review before creating another master record; existing links will not be changed."
        : undefined;
      masterTitles.add(normalized(record.title));
      // Discriminated records keep the existing studio schema intact.
      if (kind === "sources")
        entries.push({
          kind,
          key: `${kind}:${record.id}`,
          record: record as Source,
          reviewReason,
        });
      else
        entries.push({
          kind,
          key: `${kind}:${record.id}`,
          record: record as Visual,
          reviewReason,
        });
    }
  }
  return { entries, skipped };
}

export function packSelection(preview: PackPreview) {
  const accepted = new Set(
    preview.entries
      .filter((entry) => entry.kind === "lessons" && !entry.reviewReason)
      .map((entry) => entry.key),
  );
  const selectedIds = new Set(
    preview.entries
      .filter((entry) => accepted.has(entry.key))
      .map((entry) => entry.record.id),
  );
  for (const entry of preview.entries)
    if (
      entry.kind !== "lessons" &&
      !entry.reviewReason &&
      entry.record.lessonIds.some((id) => selectedIds.has(id))
    )
      accepted.add(entry.key);
  return accepted;
}

export function selectedPackEntries(
  preview: PackPreview,
  accepted: Set<string>,
): PackEntry[] {
  const lessons = preview.entries.filter(
    (entry) => entry.kind === "lessons" && accepted.has(entry.key),
  );
  const lessonIds = new Set(lessons.map((entry) => entry.record.id));
  return preview.entries.filter(
    (entry) =>
      accepted.has(entry.key) &&
      (entry.kind === "lessons" ||
        entry.record.lessonIds.some((id) => lessonIds.has(id))),
  );
}

export function applyLessonPack(
  library: Library,
  preview: PackPreview,
  accepted: Set<string>,
) {
  const entries = selectedPackEntries(preview, accepted);
  const lessons = entries.filter((entry) => entry.kind === "lessons");
  if (!lessons.length)
    throw new Error("Select at least one new lesson to add.");
  const lessonIds = new Set(lessons.map((entry) => entry.record.id));
  const next = {
    ...library,
    lessons: [...library.lessons],
    sources: [...library.sources],
    visuals: [...library.visuals],
  };
  for (const entry of entries) {
    if (library[entry.kind].some((record) => record.id === entry.record.id))
      throw new Error(
        "A selected ID now exists. Preview the pack again; nothing has been added.",
      );
    if (entry.kind === "lessons") {
      if (
        !library.pillars.some((pillar) => pillar.id === entry.record.pillarId)
      )
        throw new Error("A pillar changed. Preview the pack again.");
      next.lessons.push(entry.record);
    } else {
      const record = {
        ...entry.record,
        lessonIds: entry.record.lessonIds.filter((id) => lessonIds.has(id)),
      };
      if (entry.kind === "sources") next.sources.push(record as Source);
      else next.visuals.push(record as Visual);
    }
  }
  return next;
}
