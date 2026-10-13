import { useEffect, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { backupLibrary, download, saveLibrary, type Library } from "./library";
import {
  applyLessonPack,
  maxPackBytes,
  packSelection,
  previewLessonPack,
  selectedPackEntries,
  type PackEntry,
  type PackPreview,
} from "./lessonPack";
import { useDialogFocus } from "./dialog";

export default function LessonPackImport({
  library,
  close,
  onSaved,
  notify,
}: {
  library: Library;
  close: () => void;
  onSaved: (value: Library) => void;
  notify: (message: string) => void;
}) {
  const [preview, setPreview] = useState<PackPreview | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [report, setReport] = useState("");
  useEffect(() => {
    setBackedUp(false);
  }, [library]);
  const safeClose = () => {
    if (!busy) close();
  };
  const dialogRef = useDialogFocus(safeClose);
  const selected = preview ? selectedPackEntries(preview, accepted) : [];
  const count = (kind: PackEntry["kind"]) =>
    selected.filter((entry) => entry.kind === kind).length;
  const selectedIds = new Set(
    selected
      .filter((entry) => entry.kind === "lessons")
      .map((entry) => entry.record.id),
  );
  const read = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setPreview(null);
    setAccepted(new Set());
    try {
      if (file.size > maxPackBytes)
        throw new Error("Lesson packs must be 10 MB or smaller.");
      const next = await previewLessonPack(await file.text(), library);
      setPreview(next);
      setAccepted(packSelection(next));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not read the lesson pack. Nothing has been added.",
      );
    } finally {
      setBusy(false);
    }
  };
  const safetyBackup = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await backupLibrary(library);
      download(
        `learning-to-spiral-before-pack-${new Date().toISOString().slice(0, 10)}.json`,
        new Blob([data], { type: "application/json" }),
      );
      setBackedUp(true);
    } catch {
      setError(
        "The safety backup could not be prepared. Retry before adding the pack.",
      );
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!preview || !backedUp || busy || completed) return;
    setBusy(true);
    setError("");
    try {
      const next = applyLessonPack(library, preview, accepted);
      await saveLibrary(next);
      const held = preview.entries.filter(
        (entry) => !selected.some((item) => item.key === entry.key),
      );
      const counts = library.pillars.map(
        (pillar) =>
          `${pillar.name}: ${selected.filter((entry) => entry.kind === "lessons" && entry.record.pillarId === pillar.id).length} added`,
      );
      setReport(
        [
          "# Lesson pack import completed",
          "",
          `Added ${count("lessons")} lessons, ${count("sources")} sources and ${count("visuals")} visual briefs.`,
          "Existing lessons, pillar context, notes, quotations, sources, visuals, attachments and links were preserved.",
          "New source and visual links include only accepted new lessons. Image filenames remain locators; no images were uploaded by the pack.",
          "",
          "## Counts by pillar",
          ...counts,
          "",
          "## Inserted IDs",
          ...selected.map(
            (entry) =>
              `${entry.kind}: ${entry.record.id} — ${entry.record.title}`,
          ),
          "",
          "## Not added / held for review",
          ...(held.length
            ? held.map(
                (entry) =>
                  `${entry.record.id} — ${entry.record.title}${entry.reviewReason ? `: ${entry.reviewReason}` : ": not selected or no accepted lesson link"}`,
              )
            : ["None"]),
          "",
          "## Skipped existing IDs",
          ...(preview.skipped.length
            ? preview.skipped.map(
                (item) => `${item.id} — ${item.title}: ${item.reason}`,
              )
            : ["None"]),
          "",
          "All accepted links were validated. Download a new portable backup from the Studio after closing this dialog.",
        ].join("\n"),
      );
      setCompleted(true);
      onSaved(next);
      notify(
        `Added ${count("lessons")} lessons, ${count("sources")} sources and ${count("visuals")} visual briefs. Existing work preserved.`,
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The pack could not be saved. Your previous workspace is unchanged.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) safeClose();
      }}
    >
      <div
        className="modal exchange-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pack-title"
        ref={dialogRef}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">ADD TO YOUR EXISTING WORK</span>
            <h2 id="pack-title">Add lesson pack</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            disabled={busy}
            onClick={safeClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <p className="muted">
            Upload a lesson pack to preview new drafts, references and visual
            briefs. Existing records and pillar details stay intact. Only
            selected additions are saved.
          </p>
          {completed ? (
            <p role="status">
              Added {count("lessons")} lessons, {count("sources")} sources and{" "}
              {count("visuals")} visual briefs. Download the import report for
              IDs and items held for review.
            </p>
          ) : (
            <div className="import-input-actions">
              <label className="secondary file-upload-button">
                <Upload size={15} /> Choose lesson pack
                <input
                  type="file"
                  accept=".json,application/json"
                  aria-label="Upload additive lesson pack"
                  disabled={busy}
                  onChange={(event) => {
                    read(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
              <button
                className="secondary"
                disabled={busy}
                onClick={safetyBackup}
              >
                <Download size={15} />
                {backedUp
                  ? "Safety backup downloaded"
                  : "Download safety backup"}
              </button>
            </div>
          )}
          {preview && (
            <section className="update-review" aria-label="Lesson pack preview">
              <h3>
                {count("lessons")} lessons, {count("sources")} sources,{" "}
                {count("visuals")} visual briefs selected
              </h3>
              <p className="small muted">
                Possible overlaps start unticked. Review the draft before
                choosing to add it. Sources and visuals are linked only to
                selected new lessons.
              </p>
              <dl className="change-details">
                {library.pillars.map((pillar) => (
                  <div key={pillar.id}>
                    <dt>{pillar.name}</dt>
                    <dd>
                      {
                        selected.filter(
                          (entry) =>
                            entry.kind === "lessons" &&
                            entry.record.pillarId === pillar.id,
                        ).length
                      }{" "}
                      new lessons
                    </dd>
                  </div>
                ))}
              </dl>
              {preview.entries.map((entry) => {
                const eligible =
                  entry.kind === "lessons" ||
                  entry.record.lessonIds.some((id) => selectedIds.has(id));
                const record = entry.record;
                return (
                  <article
                    className={`change-card ${accepted.has(entry.key) && eligible ? "accepted" : ""}`}
                    key={entry.key}
                  >
                    <label className="change-choice">
                      <input
                        type="checkbox"
                        aria-label={`Add ${entry.kind === "lessons" ? "lesson" : entry.kind === "sources" ? "source" : "visual"}: ${record.title}`}
                        checked={accepted.has(entry.key) && eligible}
                        disabled={busy || completed || !eligible}
                        onChange={(event) =>
                          setAccepted((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(entry.key);
                            else next.delete(entry.key);
                            return next;
                          })
                        }
                      />
                      <span>
                        <small>
                          {entry.kind === "lessons"
                            ? library.pillars.find(
                                (pillar) => pillar.id === entry.record.pillarId,
                              )?.name
                            : entry.kind === "sources"
                              ? "SOURCE"
                              : "VISUAL BRIEF"}
                        </small>
                        <strong>{record.title}</strong>
                      </span>
                    </label>
                    {entry.reviewReason && (
                      <p className="small muted">{entry.reviewReason}</p>
                    )}
                    {!eligible && (
                      <p className="small muted">
                        Select a linked lesson to include this record.
                      </p>
                    )}
                    <details className="exchange-format">
                      <summary>Review draft and ID</summary>
                      <p className="small muted">ID: {record.id}</p>
                      <pre className="export-preview">
                        {entry.kind === "lessons"
                          ? `${entry.record.summary}\n\n${entry.record.content}\n\nNotes:\n${entry.record.notes}`
                          : entry.kind === "sources"
                            ? `Author: ${entry.record.author || "[not recorded]"}\nYear: ${entry.record.year || "[not recorded]"}\nType: ${entry.record.type}\nStatus: ${entry.record.status}\nURL / DOI: ${entry.record.url}\nReference: ${entry.record.reference}\n\n${entry.record.findings}\n\nNotes:\n${entry.record.notes}`
                            : `Status: ${entry.record.status}\nConcept: ${entry.record.concept}\nPlacement: ${entry.record.placement}\nURL: ${entry.record.url}\n\n${entry.record.description}\n\nNotes:\n${entry.record.notes}`}
                      </pre>
                    </details>
                  </article>
                );
              })}
              {!!preview.skipped.length && (
                <details className="exchange-format">
                  <summary>{preview.skipped.length} records skipped</summary>
                  {preview.skipped.map((item) => (
                    <p key={item.id}>
                      {item.title} ({item.id}): {item.reason}
                    </p>
                  ))}
                </details>
              )}
            </section>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {preview && !backedUp && !completed && (
            <p className="small muted">
              Download a safety backup above before adding the selected drafts.
            </p>
          )}
        </div>
        <div className="modal-footer">
          <span className="small muted">Existing work is preserved.</span>
          <div className="footer-spacer" />
          <button className="secondary" disabled={busy} onClick={safeClose}>
            {completed ? "Done" : "Cancel"}
          </button>
          {completed ? (
            <button
              className="primary"
              onClick={() =>
                download(
                  "learning-to-spiral-import-report.md",
                  new Blob([report], { type: "text/markdown" }),
                )
              }
            >
              Download import report
            </button>
          ) : (
            <button
              className="primary"
              disabled={busy || !preview || !backedUp || !count("lessons")}
              onClick={save}
            >
              {busy ? "Preparing…" : "Add selected drafts"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
