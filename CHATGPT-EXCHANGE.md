# Lesson Studio ↔ ChatGPT

This is a manual exchange. No API key, account connection, or ChatGPT integration is required.

1. Open a lesson and click **Copy for ChatGPT**. Paste the Markdown brief into ChatGPT, along with your request. The brief contains the permanent lesson ID, current teaching content, notes, outstanding questions, and linked research, quotations, and diagram descriptions. It also contains the response contract below. If clipboard access is unavailable, select and copy the brief in the export dialog.
2. Ask ChatGPT to return only a lesson-update JSON object. Copy that response, or save it as a `.json` file.
3. Click **Import from ChatGPT** inside the same lesson. Paste the response or use **Upload JSON file**, then click **Preview changes**.
4. Review the current and proposed text. Tick each revision or addition you accept; unticked items are rejected. Click **Save accepted changes**. Nothing is written during preview. Cancel leaves the workspace untouched.

The exchange importer updates one existing lesson. It is separate from **Restore backup**, which replaces the entire workspace. Keep the standalone HTML at the same location when updating it, and download a portable backup before moving it.

## Exact response format

Use the lesson ID supplied in the copied brief; it is not the title or pillar number. This minimal example revises only teaching notes:

```json
{
  "format": "learning-to-spiral.lesson-update",
  "version": 1,
  "lessonId": "COPY_THE_EXACT_LESSON_ID_FROM_THE_BRIEF",
  "changes": {
    "content": "## Foundation\nRevised teaching notes.\n\n## Practice\nA reflection prompt."
  },
  "additions": {
    "research": [],
    "quotes": [],
    "diagrams": []
  }
}
```

Replace the lessonId placeholder with the exact ID. The app rejects unknown IDs and updates belonging to another open lesson. `format`, `version`, and `lessonId` are required. `changes` and `additions` are optional. A single fenced `json` code block is also accepted; surrounding prose is rejected. Maximum input size is 2 MB.

### Lesson revisions

Only the following keys are accepted inside `changes`. Every value must be a string containing the complete proposed replacement, not an instruction or patch. Use JSON `\n` escapes to preserve Markdown line breaks.

| Key | Lesson field |
| --- | --- |
| `title` | Lesson title; cannot be blank |
| `summary` | Lesson overview |
| `content` | Teaching notes |
| `notes` | My reflections & notes |
| `questions` | Outstanding questions |

Omitted fields are preserved exactly. Unchanged values are left out of the preview. An explicitly supplied empty string clears that field only if you accept its revision. The permanent ID and pillar cannot be changed through this exchange.

### New research suggestions

Each `additions.research` entry requires a response-local `key` and a `title`. These are additions, not replacements for existing master records.

```json
{
  "key": "suggested-reference-1",
  "title": "Title of a reference to verify",
  "author": "",
  "year": "",
  "type": "Other",
  "url": "",
  "reference": "",
  "findings": "An idea to investigate, rather than a verified finding.",
  "notes": "Why this reference may help the lesson.",
  "status": "Awaiting verification"
}
```

Other fields are optional strings; unknown attribution stays blank. `type` accepts `Research paper`, `Book`, `Article`, `Spiritual text`, or `Other` (default). `url` accepts an http/https URL or DOI. `status` is always **Awaiting verification**: it can be omitted or explicitly set to that value. The importer rejects claims that a new suggestion is already reviewed. Once you verify the reference yourself, change its reading status in the normal research editor. Keys must be unique within the response, with at most 100 research entries.

### New quotations

Each `additions.quotes` entry requires exact `text` and exactly one of:

- `sourceId`: an existing research entry's permanent ID, shown in the brief; or
- `sourceKey`: the key of a research suggestion in this response.

```json
{
  "sourceId": "COPY_AN_EXISTING_SOURCE_ID_FROM_THE_BRIEF",
  "text": "COPY_ONLY_AN_EXACT_PASSAGE_FROM_THAT_SOURCE",
  "reference": "",
  "point": "The teaching point it supports.",
  "commentary": "My interpretation.",
  "use": "General reference"
}
```

Replace the placeholders with known source information; omit quotations when exact wording is unavailable. `reference`, `point`, and `commentary` are optional strings. `use` accepts `YouTube`, `TikTok`, `Essay`, or `General reference` (default). Attribution remains attached to the original research entry. The importer never supplies a missing author or publication year. If you accept a quote using `sourceKey`, you must also accept its research suggestion; otherwise saving is blocked without changing data. At most 100 quotes are allowed.

### New diagram suggestions

Each `additions.diagrams` entry requires a `title`:

```json
{
  "title": "A proposed teaching model",
  "description": "How the visual could communicate the idea.",
  "concept": "The concept being illustrated.",
  "placement": "Opening explanation",
  "status": "Idea",
  "notes": "Revision or design notes.",
  "url": ""
}
```

Other fields are optional strings. `status` accepts `Idea` (default), `To design`, `Draft`, or `Final`. `url` must be blank or an http/https link. This creates a description or external reference; it does not pretend to upload an image. Add the image later in the diagram editor. At most 100 diagrams are allowed.

## Preservation and validation

The importer never removes or revises an existing source, quote, diagram, or attachment. Those master records can still be edited through their existing library dialogs. Accepted new entries are linked to the selected lesson; other lessons stay unchanged. Unknown fields, deletion requests, invalid types or statuses, unsafe URLs, missing source links, malformed JSON, and mismatched IDs are rejected before any data is written.

Saving applies all accepted changes in one IndexedDB transaction. If saving fails, the previous workspace remains intact and the preview stays open for retry. The app also detects a lesson field changing between preview and acceptance and requests a new preview instead of overwriting it.

## Validated example

The browser suite uses **Self-image · Lesson 1** with existing personal notes, a shared research record, an attributed quote, a shared diagram, and two attachments. It verifies actual clipboard text and line breaks, previews multiple suggestions without saving, accepts teaching-note and outstanding-question revisions plus selected additions, rejects an unwanted personal-note revision and quote, reloads the app, and checks that all original linked records and attachment bytes are preserved. JSON uploads, malformed data, source dependencies, cancellation, save failure/retry, and the standalone artifact with network access disabled are also exercised. No test data is inserted into the user's browser.
