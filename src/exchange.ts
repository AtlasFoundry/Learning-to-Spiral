import {
  id,
  lessonExport,
  safeUrl,
  sourceTypes,
  uses,
  visualStatuses,
  type Lesson,
  type Library,
  type Source,
  type Quote,
  type Visual,
} from "./library";

export const exchangeFormat = "learning-to-spiral.lesson-update";
export const maxUpdateBytes = 2 * 1024 * 1024;
export const lessonFields = {
  title: "Lesson title",
  summary: "Lesson overview",
  content: "Teaching notes",
  notes: "My reflections & notes",
  questions: "Outstanding questions",
} as const;
type LessonField = keyof typeof lessonFields;
export type ReviewChange =
  | {
      key: string;
      kind: "lesson";
      label: string;
      field: LessonField;
      before: string;
      after: string;
    }
  | { key: string; kind: "research"; label: string; record: Source }
  | {
      key: string;
      kind: "quote";
      label: string;
      record: Quote;
      sourceLabel: string;
      dependency?: string;
    }
  | { key: string; kind: "diagram"; label: string; record: Visual };
export type UpdatePreview = { lessonId: string; changes: ReviewChange[] };

export function responseTemplate(lessonId: string) {
  return JSON.stringify(
    {
      format: exchangeFormat,
      version: 1,
      lessonId,
      changes: {
        content:
          "Revised teaching notes, with Markdown and line breaks preserved.",
      },
      additions: { research: [], quotes: [], diagrams: [] },
    },
    null,
    2,
  );
}
export function chatGPTBrief(library: Library, lesson: Lesson) {
  return [
    "# Instructions for ChatGPT",
    `Work only on the selected lesson (permanent ID: ${lesson.id}). Use the brief below; do not rewrite unrelated lessons or content. Preserve my existing notes and supporting material unless I explicitly request a revision. Address the outstanding questions when relevant.`,
    "Do not invent sources, quotation wording, authors, dates, or page references. New research is a suggestion awaiting verification. Keep missing attribution blank.",
    "\n# Selected lesson brief",
    lessonExport(library, lesson),
    "\n# Return format",
    "Return one JSON object, without surrounding prose. Copy the exact lessonId. Include only explicitly proposed changes; omitted fields stay unchanged. Each changed field contains the complete replacement text, with Markdown and line breaks encoded as JSON strings. I will review and approve each item before saving.",
    "Allowed changes: title, summary (lesson overview), content (teaching notes), notes (my reflections), questions (outstanding questions). Do not return pillarId, deletion requests, existing library revisions, or attachments.",
    "Optional additions.research entries: key (unique within this response), title, author, year, type (Research paper, Book, Article, Spiritual text, Other), url (URL or DOI), reference, findings, notes, status (only Awaiting verification). Only key and title are required; leave unknown attribution blank.",
    "Optional additions.quotes entries: text, sourceId (an existing source ID in the brief) OR sourceKey (the key of a research suggestion in this response), reference, point, commentary, use (YouTube, TikTok, Essay, General reference). Exact text and one source reference are required. Never fabricate a quote.",
    "Optional additions.diagrams entries: title, description, concept, placement, status (Idea, To design, Draft, Final), notes, url (http/https link). Only title is required. Describe a proposed diagram; do not claim to upload a file.",
    "\n```json",
    responseTemplate(lesson.id),
    "```",
  ].join("\n");
}
export async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    /* Local files can deny the Clipboard API. Try the user-initiated fallback. */
  }
  const previous = document.activeElement as HTMLElement | null;
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("aria-hidden", "true");
  input.style.cssText = "position:fixed;left:-10000px;top:0;";
  document.body.append(input);
  input.select();
  try {
    if (!document.execCommand("copy"))
      throw new Error(
        "Clipboard unavailable. Select and copy the brief shown below.",
      );
  } finally {
    input.remove();
    previous?.focus({ preventScroll: true });
  }
}

type ObjectValue = Record<string, unknown>;
function object(value: unknown, path: string): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${path} must be a JSON object.`);
  return value as ObjectValue;
}
function keys(value: ObjectValue, allowed: string[], path: string) {
  const invalid = Object.keys(value).filter((key) => !allowed.includes(key));
  if (invalid.length)
    throw new Error(
      `${path} contains unsupported fields: ${invalid.join(", ")}. Deletions and automatic changes to existing library records are not supported.`,
    );
}
function string(
  value: ObjectValue,
  key: string,
  path: string,
  required = false,
): string {
  if (!(key in value)) {
    if (required) throw new Error(`${path}.${key} is required.`);
    return "";
  }
  if (typeof value[key] !== "string" || (value[key] as string).length > 100000)
    throw new Error(
      `${path}.${key} must be a string of at most 100,000 characters.`,
    );
  if (required && !(value[key] as string).trim())
    throw new Error(`${path}.${key} must not be empty.`);
  return value[key] as string;
}
function choice(
  value: ObjectValue,
  key: string,
  options: readonly string[],
  fallback: string,
  path: string,
) {
  if (!(key in value)) return fallback;
  const result = string(value, key, path);
  if (!options.includes(result))
    throw new Error(`${path}.${key} must be one of: ${options.join(", ")}.`);
  return result;
}
function url(value: ObjectValue, path: string, doi = false) {
  const result = string(value, "url", path);
  if (result && (!safeUrl(result) || (!doi && !/^https?:\/\//i.test(result))))
    throw new Error(
      `${path}.url must be an http/https URL${doi ? " or DOI" : ""}.`,
    );
  return result;
}
function list(value: ObjectValue, key: string): unknown[] {
  if (!(key in value)) return [];
  if (!Array.isArray(value[key]) || value[key].length > 100)
    throw new Error(
      `additions.${key} must be an array of at most 100 entries.`,
    );
  return value[key] as unknown[];
}
export function previewUpdate(
  input: string,
  library: Library,
  selectedLessonId: string,
): UpdatePreview {
  if (new Blob([input]).size > maxUpdateBytes)
    throw new Error("Lesson updates must be 2 MB or smaller.");
  const fenced = /^\s*```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i.exec(input);
  let parsed: unknown;
  try {
    parsed = JSON.parse(fenced ? fenced[1] : input);
  } catch {
    throw new Error(
      "Malformed JSON. Paste a JSON object or a single JSON code block. Nothing has been changed.",
    );
  }
  const value = object(parsed, "Update");
  keys(
    value,
    ["format", "version", "lessonId", "changes", "additions"],
    "Update",
  );
  if (value.format !== exchangeFormat || value.version !== 1)
    throw new Error(`Use format "${exchangeFormat}" and version 1.`);
  const lessonId = string(value, "lessonId", "Update", true);
  const lesson = library.lessons.find((l) => l.id === lessonId);
  if (!lesson)
    throw new Error(
      "No lesson has this permanent ID. Copy a fresh brief from the lesson you want to update.",
    );
  if (lessonId !== selectedLessonId)
    throw new Error(
      "This update belongs to another lesson. Open that lesson before importing it.",
    );
  const changes: ReviewChange[] = [];
  if ("changes" in value) {
    const fields = object(value.changes, "changes");
    keys(fields, Object.keys(lessonFields), "changes");
    for (const field of Object.keys(fields) as LessonField[]) {
      const after = string(fields, field, "changes", field === "title");
      const before = lesson[field] ?? "";
      if (after !== before)
        changes.push({
          key: `lesson:${field}`,
          kind: "lesson",
          label: lessonFields[field],
          field,
          before,
          after,
        });
    }
  }
  const additions =
    "additions" in value ? object(value.additions, "additions") : {};
  keys(additions, ["research", "quotes", "diagrams"], "additions");
  const newSources = new Map<string, { record: Source; changeKey: string }>();
  for (const [index, entry] of list(additions, "research").entries()) {
    const path = `additions.research[${index}]`;
    const item = object(entry, path);
    keys(
      item,
      [
        "key",
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
      path,
    );
    const sourceKey = string(item, "key", path, true);
    if (newSources.has(sourceKey))
      throw new Error(`Duplicate research key: ${sourceKey}.`);
    const record: Source = {
      id: id(),
      title: string(item, "title", path, true),
      author: string(item, "author", path),
      year: string(item, "year", path),
      type: choice(item, "type", sourceTypes, "Other", path),
      url: url(item, path, true),
      reference: string(item, "reference", path),
      findings: string(item, "findings", path),
      notes: string(item, "notes", path),
      status: choice(
        item,
        "status",
        ["Awaiting verification"],
        "Awaiting verification",
        path,
      ),
      lessonIds: [lessonId],
      attachmentIds: [],
    };
    const changeKey = `research:${sourceKey}`;
    newSources.set(sourceKey, { record, changeKey });
    changes.push({
      key: changeKey,
      kind: "research",
      label: record.title,
      record,
    });
  }
  for (const [index, entry] of list(additions, "quotes").entries()) {
    const path = `additions.quotes[${index}]`;
    const item = object(entry, path);
    keys(
      item,
      [
        "text",
        "sourceId",
        "sourceKey",
        "reference",
        "point",
        "commentary",
        "use",
      ],
      path,
    );
    if ("sourceId" in item === "sourceKey" in item)
      throw new Error(
        `${path} needs exactly one sourceId or sourceKey to preserve attribution.`,
      );
    const suggested =
      "sourceKey" in item
        ? newSources.get(string(item, "sourceKey", path, true))
        : undefined;
    const source =
      "sourceId" in item
        ? library.sources.find(
            (s) => s.id === string(item, "sourceId", path, true),
          )
        : suggested?.record;
    if (!source)
      throw new Error(
        `${path} references an unknown source. Record the original research source first.`,
      );
    const record: Quote = {
      id: id(),
      text: string(item, "text", path, true),
      sourceId: source.id,
      reference: string(item, "reference", path),
      point: string(item, "point", path),
      commentary: string(item, "commentary", path),
      use: choice(item, "use", uses, "General reference", path),
      lessonIds: [lessonId],
    };
    changes.push({
      key: `quote:${index}`,
      kind: "quote",
      label: `Quote ${index + 1}`,
      record,
      sourceLabel: `${source.author || "[author not recorded]"} · ${source.title}`,
      dependency: suggested?.changeKey,
    });
  }
  for (const [index, entry] of list(additions, "diagrams").entries()) {
    const path = `additions.diagrams[${index}]`;
    const item = object(entry, path);
    keys(
      item,
      [
        "title",
        "description",
        "concept",
        "placement",
        "status",
        "notes",
        "url",
      ],
      path,
    );
    const record: Visual = {
      id: id(),
      title: string(item, "title", path, true),
      description: string(item, "description", path),
      concept: string(item, "concept", path),
      placement: string(item, "placement", path),
      status: choice(item, "status", visualStatuses, "Idea", path),
      notes: string(item, "notes", path),
      url: url(item, path),
      attachmentId: "",
      lessonIds: [lessonId],
    };
    changes.push({
      key: `diagram:${index}`,
      kind: "diagram",
      label: record.title,
      record,
    });
  }
  return { lessonId, changes };
}
export function applyUpdate(
  library: Library,
  preview: UpdatePreview,
  accepted: Set<string>,
): Library {
  const lesson = library.lessons.find((l) => l.id === preview.lessonId);
  if (!lesson)
    throw new Error("The lesson no longer exists. Nothing was changed.");
  const selected = preview.changes.filter((c) => accepted.has(c.key));
  if (!selected.length)
    throw new Error("Accept at least one change before saving.");
  const patch: Partial<Lesson> = {};
  const sources = [...library.sources];
  const quotes = [...library.quotes];
  const visuals = [...library.visuals];
  for (const change of selected) {
    if (change.kind === "lesson") {
      if ((lesson[change.field] ?? "") !== change.before)
        throw new Error(
          `${change.label} changed since this preview. Preview the update again before saving.`,
        );
      patch[change.field] = change.after;
    } else if (change.kind === "research") sources.push(change.record);
    else if (change.kind === "diagram") visuals.push(change.record);
  }
  for (const change of selected)
    if (change.kind === "quote") {
      if (change.dependency && !accepted.has(change.dependency))
        throw new Error(
          "A selected quote uses a new research suggestion. Accept its source too, or reject the quote.",
        );
      if (!sources.some((s) => s.id === change.record.sourceId))
        throw new Error(
          "The quote source no longer exists. Preview the update again.",
        );
      quotes.push(change.record);
    }
  return {
    ...library,
    lessons: library.lessons.map((l) =>
      l.id === lesson.id ? { ...l, ...patch } : l,
    ),
    sources,
    quotes,
    visuals,
  };
}
