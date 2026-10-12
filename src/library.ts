export const sourceTypes = [
  "Research paper",
  "Book",
  "Article",
  "Spiritual text",
  "Other",
] as const;
export const researchStatuses = [
  "To read",
  "Reading",
  "Reviewed",
  "Awaiting verification",
] as const;
export const visualStatuses = ["Idea", "To design", "Draft", "Final"] as const;
export const uses = [
  "YouTube",
  "TikTok",
  "Essay",
  "General reference",
] as const;
export type Lesson = {
  id: string;
  title: string;
  pillarId: string;
  summary: string;
  content: string;
  notes: string;
  questions?: string;
};
export type Pillar = { id: string; name: string };
export type Source = {
  id: string;
  title: string;
  author: string;
  year: string;
  type: string;
  url: string;
  reference: string;
  findings: string;
  notes: string;
  status: string;
  lessonIds: string[];
  attachmentIds: string[];
};
export type Quote = {
  id: string;
  text: string;
  sourceId: string;
  reference: string;
  point: string;
  commentary: string;
  use: string;
  lessonIds: string[];
};
export type Visual = {
  id: string;
  title: string;
  description: string;
  concept: string;
  placement: string;
  status: string;
  notes: string;
  url: string;
  attachmentId: string;
  lessonIds: string[];
};
export type Attachment = { id: string; name: string; mime: string; blob: Blob };
export type Library = {
  version: 1;
  pillarNamesVersion?: 1;
  pillars: Pillar[];
  lessons: Lesson[];
  sources: Source[];
  quotes: Quote[];
  visuals: Visual[];
  attachments: Attachment[];
};
export const id = () => crypto.randomUUID();
export const pillarNames = [
  "Self-image",
  "Attention & mind",
  "Goals & discernment",
  "Intention",
  "Imagination & feeling",
  "Autosuggestion & conditioning",
  "Faith & prayer",
  "Order, action & movement",
  "Integration & embodiment",
] as const;
function updatePillarNames(library: Library): Library {
  if (library.pillarNamesVersion === 1) return library;
  return {
    ...library,
    pillarNamesVersion: 1,
    pillars: library.pillars.map((pillar) => {
      const index = pillarNames.findIndex(
        (_, i) => pillar.id === `pillar-${i + 1}`,
      );
      return index >= 0 && pillar.name === `Pillar ${index + 1}`
        ? { ...pillar, name: pillarNames[index] }
        : pillar;
    }),
  };
}
export const emptyLibrary = (): Library => ({
  version: 1,
  pillarNamesVersion: 1,
  pillars: pillarNames.map((name, i) => ({
    id: `pillar-${i + 1}`,
    name,
  })),
  lessons: [],
  sources: [],
  quotes: [],
  visuals: [],
  attachments: [],
});
export function safeUrl(value: string): string | undefined {
  if (!value.trim()) return;
  const raw = value.trim();
  const doi = /^(?:doi:\s*)?(10\.\d{4,9}\/\S+)$/i.exec(raw);
  try {
    const url = new URL(doi ? `https://doi.org/${doi[1]}` : raw);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return;
  }
}
let database: Promise<IDBDatabase> | undefined;
function db() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("learning-to-spiral", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("studio");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Close other studio tabs to open storage."));
  }));
}
export async function loadLibrary(): Promise<Library> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database
      .transaction("studio")
      .objectStore("studio")
      .get("library");
    request.onsuccess = () =>
      resolve(updatePillarNames(request.result ?? emptyLibrary()));
    request.onerror = () => reject(request.error);
  });
}
let saveQueue = Promise.resolve();
export function saveLibrary(library: Library) {
  const operation = saveQueue
    .catch(() => {})
    .then(async () => {
      const database = await db();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction("studio", "readwrite");
        transaction.objectStore("studio").put(library, "library");
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () =>
          reject(transaction.error ?? new Error("Storage write aborted"));
      });
    });
  saveQueue = operation;
  return operation;
}
export function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const dataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
export async function backupLibrary(library: Library) {
  return JSON.stringify(
    {
      ...library,
      exportedAt: new Date().toISOString(),
      attachments: await Promise.all(
        library.attachments.map(async ({ blob, ...attachment }) => ({
          ...attachment,
          data: await dataUrl(blob),
        })),
      ),
    },
    null,
    2,
  );
}
export async function restoreLibrary(text: string): Promise<Library> {
  // Validate before replacing anything. No defaults that manufacture attribution.
  const value = JSON.parse(text);
  const fail = () => {
    throw new Error(
      "This is not a valid Learning to Spiral backup. Nothing was replaced.",
    );
  };
  if (!value || value.version !== 1) fail();
  if (value.pillarNamesVersion !== undefined && value.pillarNamesVersion !== 1)
    fail();
  const fields: Record<string, string[]> = {
    pillars: ["id", "name"],
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
    ],
    quotes: [
      "id",
      "text",
      "sourceId",
      "reference",
      "point",
      "commentary",
      "use",
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
    ],
    attachments: ["id", "name", "mime", "data"],
  };
  for (const [collection, required] of Object.entries(fields)) {
    if (!Array.isArray(value[collection]) || value[collection].length > 10000)
      fail();
    const seen = new Set();
    for (const item of value[collection]) {
      if (
        !item ||
        required.some((key) => typeof item[key] !== "string") ||
        !item.id ||
        seen.has(item.id)
      )
        fail();
      seen.add(item.id);
    }
  }
  if (value.pillars.length !== 9) fail();
  const contains = (list: { id: string }[], key: string) =>
    list.some((item) => item.id === key);
  const linksValid = (item: { lessonIds: string[] }) =>
    Array.isArray(item.lessonIds) &&
    new Set(item.lessonIds).size === item.lessonIds.length &&
    item.lessonIds.every(
      (link) => typeof link === "string" && contains(value.lessons, link),
    );
  for (const lesson of value.lessons)
    if (
      !contains(value.pillars, lesson.pillarId) ||
      (lesson.questions !== undefined && typeof lesson.questions !== "string")
    )
      fail();
  for (const source of value.sources)
    if (
      !linksValid(source) ||
      !sourceTypes.includes(source.type) ||
      !researchStatuses.includes(source.status) ||
      !Array.isArray(source.attachmentIds) ||
      source.attachmentIds.some(
        (link: string) => !contains(value.attachments, link),
      )
    )
      fail();
  for (const quote of value.quotes)
    if (
      !linksValid(quote) ||
      !contains(value.sources, quote.sourceId) ||
      !uses.includes(quote.use)
    )
      fail();
  for (const visual of value.visuals)
    if (
      !linksValid(visual) ||
      !visualStatuses.includes(visual.status) ||
      (visual.attachmentId && !contains(value.attachments, visual.attachmentId))
    )
      fail();
  const attachments = value.attachments.map(
    (attachment: { id: string; name: string; mime: string; data: string }) => {
      const match = /^data:[^,]*;base64,([A-Za-z0-9+/]*={0,2})$/.exec(
        attachment.data,
      );
      if (!match) return fail();
      let bytes: Uint8Array<ArrayBuffer>;
      try {
        bytes = Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0));
      } catch {
        return fail();
      }
      if (bytes.length > 10 * 1024 * 1024) fail();
      return {
        id: attachment.id,
        name: attachment.name,
        mime: attachment.mime,
        blob: new Blob([bytes!], { type: attachment.mime }),
      };
    },
  );
  for (const visual of value.visuals)
    if (
      visual.attachmentId &&
      !["image/png", "image/jpeg", "image/svg+xml"].includes(
        attachments.find((a: Attachment) => a.id === visual.attachmentId)?.mime,
      )
    )
      fail();
  return updatePillarNames({
    version: 1,
    pillarNamesVersion: value.pillarNamesVersion,
    pillars: value.pillars,
    lessons: value.lessons,
    sources: value.sources,
    quotes: value.quotes,
    visuals: value.visuals,
    attachments,
  });
}
export function lessonExport(library: Library, lesson: Lesson) {
  const quotes = library.quotes.filter((q) => q.lessonIds.includes(lesson.id));
  const sources = library.sources.filter(
    (s) =>
      s.lessonIds.includes(lesson.id) ||
      quotes.some((q) => q.sourceId === s.id),
  );
  const visuals = library.visuals.filter((v) =>
    v.lessonIds.includes(lesson.id),
  );
  const lines = [
    `# ${lesson.title}`,
    `Lesson ID: ${lesson.id}`,
    `Pillar: ${library.pillars.find((p) => p.id === lesson.pillarId)?.name}`,
    "\n## Lesson overview",
    lesson.summary,
    "\n## Teaching notes",
    lesson.content,
    "\n## My notes",
    lesson.notes,
    "\n## Outstanding questions",
    lesson.questions || "[none recorded]",
    "\n## Research",
  ];
  for (const s of sources)
    lines.push(
      `\n### ${s.title}`,
      `Source ID: ${s.id}`,
      `Author: ${s.author || "[not recorded]"} | Year: ${s.year || "[not recorded]"} | ${s.type} | ${s.status}`,
      `URL / DOI: ${s.url || "[not recorded]"}`,
      `Pages / chapters: ${s.reference || "[not recorded]"}`,
      `Key ideas: ${s.findings}`,
      `My notes: ${s.notes}`,
      `Attachments: ${s.attachmentIds.map((a) => library.attachments.find((file) => file.id === a)?.name).join(", ") || "None"}`,
    );
  lines.push("\n## Quotes & extracts");
  for (const q of quotes) {
    const source = library.sources.find((s) => s.id === q.sourceId)!;
    lines.push(
      `\n> ${q.text.replace(/\n/g, "\n> ")}`,
      `Quote ID: ${q.id} | Source ID: ${q.sourceId}`,
      `Attribution: ${source.author || "[not recorded]"}, ${source.title}; ${q.reference || "[page/section not recorded]"}`,
      `Teaching point: ${q.point}`,
      `My interpretation: ${q.commentary}`,
      `Intended use: ${q.use}`,
    );
  }
  lines.push("\n## Diagrams & visuals");
  for (const v of visuals)
    lines.push(
      `\n### ${v.title} (${v.status})`,
      `Diagram ID: ${v.id}`,
      v.description,
      `Concept: ${v.concept}`,
      `Placement: ${v.placement}`,
      `Revision notes: ${v.notes}`,
      `External link: ${v.url || "None"}`,
      `Uploaded file: ${library.attachments.find((a) => a.id === v.attachmentId)?.name || "None"}`,
    );
  lines.push(
    "\nUse only the attribution recorded above. Do not invent authors, dates, page numbers, findings, or quotations. Uploaded file contents are included in the companion portable lesson JSON; attach relevant images/files to ChatGPT separately when needed.",
  );
  return lines.join("\n");
}
export function lessonBundle(library: Library, lesson: Lesson): Library {
  const quotes = library.quotes.filter((q) => q.lessonIds.includes(lesson.id));
  const sources = library.sources
    .filter(
      (s) =>
        s.lessonIds.includes(lesson.id) ||
        quotes.some((q) => q.sourceId === s.id),
    )
    .map((s) => ({
      ...s,
      lessonIds: s.lessonIds.includes(lesson.id) ? [lesson.id] : [],
    }));
  const visuals = library.visuals
    .filter((v) => v.lessonIds.includes(lesson.id))
    .map((v) => ({ ...v, lessonIds: [lesson.id] }));
  const attachmentIds = new Set([
    ...sources.flatMap((s) => s.attachmentIds),
    ...visuals.map((v) => v.attachmentId),
  ]);
  return {
    ...library,
    lessons: [lesson],
    sources,
    quotes: quotes.map((q) => ({ ...q, lessonIds: [lesson.id] })),
    visuals,
    attachments: library.attachments.filter((a) => attachmentIds.has(a.id)),
  };
}
