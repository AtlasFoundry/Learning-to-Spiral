# Add lesson packs

Open **Add lesson pack** in the desktop sidebar or mobile **Workspace tools**. Upload the original JSON pack: no conversion to a full workspace backup is needed.

1. Review the selected lesson drafts, sources and visual briefs. Expand **Review draft and ID** for the complete text and attribution. Each record can be accepted or rejected individually.
2. Review warnings: duplicate lesson or master-record titles and drafts whose notes mention an existing lesson start unticked. A mention is an editorial cue, not proof of duplication. Compare their teaching roles before explicitly adding an overlapping draft.
3. Choose **Download safety backup** and keep the downloaded file separately.
4. Choose **Add selected drafts**. Saving adds selected records in one IndexedDB transaction. If saving fails, the prior workspace stays intact and the preview remains available for retry.
5. Download the import report for counts by pillar, inserted IDs, skipped IDs and records not added. Close the dialog and download a new portable backup.

The importer preserves the current pillars, their aims and central dispositions, all existing lessons and notes, quotes, master library records, attachments and links. Existing IDs are skipped; even their lesson links are not modified. Re-importing the same pack does not duplicate those IDs. Only new selected records are appended. New source and visual links are limited to lessons accepted in the same import; records with no accepted lesson link are not added.

## File contract

The root has `kind: "learning-to-spiral-additive-lesson-pack"`, `schemaVersion: 1`, `studioSchemaVersion: 1`, and arrays `lessons`, `sources`, `visuals`, `quotes`, `attachments`. `quotes` and `attachments` must be empty for this pack format. Optional `lessonCount` must match `lessons.length`. Each supported collection can contain at most 1,000 records; the file limit is 10 MB. UTF-8 JSON with a byte-order marker is supported.

Each lesson requires string fields `id`, `title`, `pillarId`, `summary`, `content`, `notes`. Pillar IDs must already exist in the current workspace. The incoming pillar mapping does not change the user's pillars.

Sources use the Studio fields `id`, `title`, `author`, `year`, `type`, `url`, `reference`, `findings`, `notes`, `status`, `lessonIds`, `attachmentIds`. Unknown attribution stays blank. Source type and reading status must be valid Studio values. Statuses are supplied reading metadata, not independent verification by the importer. `attachmentIds` must be empty. URLs must be blank, http/https links or DOIs.

Visual briefs use `id`, `title`, `description`, `concept`, `placement`, `status`, `notes`, `url`, `attachmentId`, `lessonIds`. Status must be a valid Studio visual status. `attachmentId` must be an empty string; URLs must be blank or http/https links. Briefs do not fabricate uploaded images. Keep photo filenames in reference or notes fields until the original image is attached through its library editor.

All source and visual `lessonIds` must reference lessons inside the pack. Duplicate IDs within an incoming collection, unsupported record fields, invalid types/statuses, malformed JSON, unsafe links and claimed attachments are rejected before writing. Descriptive pack metadata such as `important`, `editorialNotes`, `mergeRules` and `pillarMapping` is not executed and cannot override preservation rules or update existing content.

**Import from ChatGPT** remains the separate pathway for changes to an existing lesson, matched by permanent lesson ID. **Restore backup** remains a full replacement and should only receive a portable workspace backup. Both now direct users to **Add lesson pack** when given a lesson-pack file.
