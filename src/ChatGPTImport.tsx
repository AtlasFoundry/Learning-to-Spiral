import { useState } from "react";
import { Upload, X } from "lucide-react";
import { saveLibrary, type Library } from "./library";
import {
  applyUpdate,
  maxUpdateBytes,
  previewUpdate,
  responseTemplate,
  type ReviewChange,
  type UpdatePreview,
} from "./exchange";
import { useDialogFocus } from "./dialog";

function AdditionDetails({
  change,
}: {
  change: Exclude<ReviewChange, { kind: "lesson" }>;
}) {
  const record = change.record;
  const rows: [string, string][] =
    change.kind === "research"
      ? [
          ["Author", change.record.author || "[not recorded]"],
          ["Year", change.record.year || "[not recorded]"],
          ["Source type", change.record.type],
          ["URL / DOI", change.record.url],
          ["Pages / chapters", change.record.reference],
          ["Key findings", change.record.findings],
          ["My notes", change.record.notes],
          ["Status", change.record.status],
        ]
      : change.kind === "quote"
        ? [
            ["Exact quotation", change.record.text],
            ["Original source", change.sourceLabel],
            ["Pages / section", change.record.reference],
            ["Teaching point", change.record.point],
            ["My interpretation", change.record.commentary],
            ["Intended use", change.record.use],
          ]
        : [
            ["Description", change.record.description],
            ["Concept", change.record.concept],
            ["Placement", change.record.placement],
            ["Status", change.record.status],
            ["Revision notes", change.record.notes],
            ["External link", change.record.url],
          ];
  return (
    <>
      <dl className="change-details">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      {change.kind === "quote" && (
        <p className="small muted">
          Check the exact wording and attribution before accepting.
        </p>
      )}
      {"attachmentId" in record && (
        <p className="small muted">
          Description or external link only. Existing uploaded files stay
          intact.
        </p>
      )}
    </>
  );
}
export default function ChatGPTImport({
  library,
  lessonId,
  close,
  onSaved,
  notify,
}: {
  library: Library;
  lessonId: string;
  close: () => void;
  onSaved: (library: Library) => void;
  notify: (message: string) => void;
}) {
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<UpdatePreview | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const safeClose = () => {
    if (!busy) close();
  };
  const dialogRef = useDialogFocus(safeClose);
  const lesson = library.lessons.find((l) => l.id === lessonId)!;
  const resetInput = (value: string) => {
    setInput(value);
    setPreview(null);
    setAccepted(new Set());
    setError("");
  };
  const readFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setPreview(null);
    setAccepted(new Set());
    setError("");
    try {
      if (file.size > maxUpdateBytes)
        throw new Error("Lesson updates must be 2 MB or smaller.");
      resetInput(await file.text());
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not read the JSON file.",
      );
    } finally {
      setBusy(false);
    }
  };
  const review = () => {
    setError("");
    setPreview(null);
    setAccepted(new Set());
    try {
      setPreview(previewUpdate(input, library, lessonId));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not preview this update. Nothing was changed.",
      );
    }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!preview || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = applyUpdate(library, preview, accepted);
      await saveLibrary(next); // Commit atomically before showing any change in the editor.
      onSaved(next);
      notify(
        `${accepted.size} approved ${accepted.size === 1 ? "change" : "changes"} saved. Other content and attachments preserved.`,
      );
      close();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The update could not be saved. Your previous workspace is unchanged.",
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
        aria-labelledby="exchange-title"
        ref={dialogRef}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">REVIEW BEFORE SAVING</span>
            <h2 id="exchange-title">Import from ChatGPT</h2>
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
        <form onSubmit={save}>
          <div className="modal-body">
            <p className="muted">
              Paste a lesson update or upload its JSON file. Only the changes
              you accept will be saved to <strong>{lesson.title}</strong>.
            </p>
            <p className="lesson-identity">
              Permanent lesson ID: <code>{lessonId}</code>
            </p>
            <label className="field">
              <span>JSON lesson update</span>
              <textarea
                aria-label="JSON lesson update"
                className="json-input"
                rows={8}
                value={input}
                disabled={busy}
                onChange={(e) => resetInput(e.target.value)}
                placeholder={
                  '{ "format": "learning-to-spiral.lesson-update", ... }'
                }
              />
            </label>
            <div className="import-input-actions">
              <label className="secondary file-upload-button">
                <Upload size={15} />
                Upload JSON file
                <input
                  type="file"
                  accept=".json,application/json"
                  disabled={busy}
                  aria-label="Upload ChatGPT lesson update"
                  onChange={(e) => {
                    readFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                className="primary"
                onClick={review}
                disabled={busy || !input.trim()}
              >
                Preview changes
              </button>
            </div>
            <details className="exchange-format">
              <summary>ChatGPT response format</summary>
              <p className="small muted">
                Use the exact lessonId. Include only changed fields: title,
                summary, content, notes, questions. Research, quotes, and
                diagram suggestions belong in additions; existing library
                entries and attachments cannot be deleted or replaced here. The
                copied brief explains all optional addition fields.
              </p>
              <pre className="export-preview">{responseTemplate(lessonId)}</pre>
            </details>
            {preview && (
              <section
                className="update-review"
                aria-label="Proposed lesson changes"
              >
                <div className="review-heading">
                  <h3>
                    {preview.changes.length
                      ? `${preview.changes.length} proposed ${preview.changes.length === 1 ? "change" : "changes"}`
                      : "No changes found"}
                  </h3>
                  <span className="small muted">{accepted.size} accepted</span>
                </div>
                <p className="small muted">
                  Nothing has been saved. Tick each change you want to accept;
                  leave the others unticked to reject them.
                </p>
                {preview.changes.map((change) => (
                  <article
                    className={`change-card ${accepted.has(change.key) ? "accepted" : ""}`}
                    key={change.key}
                  >
                    <label className="change-choice">
                      <input
                        type="checkbox"
                        aria-label={`Accept ${change.kind === "lesson" ? change.label : `${change.kind}: ${change.label}`}`}
                        checked={accepted.has(change.key)}
                        disabled={busy}
                        onChange={(event) =>
                          setAccepted((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(change.key);
                            else next.delete(change.key);
                            return next;
                          })
                        }
                      />
                      <span>
                        <small>
                          {change.kind === "lesson"
                            ? "REVISION"
                            : `ADD ${change.kind.toUpperCase()}`}
                        </small>
                        <strong>{change.label}</strong>
                      </span>
                    </label>
                    {change.kind === "lesson" ? (
                      <>
                        <div className="change-comparison">
                          <div>
                            <span>Current</span>
                            <pre>{change.before || "[empty]"}</pre>
                          </div>
                          <div>
                            <span>Proposed</span>
                            <pre>{change.after || "[empty]"}</pre>
                          </div>
                        </div>
                        {!change.after && (
                          <p className="small muted">
                            Accepting this change will clear this field only.
                          </p>
                        )}
                      </>
                    ) : (
                      <AdditionDetails change={change} />
                    )}
                  </article>
                ))}
              </section>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <span className="small muted">
              Other lesson content stays intact.
            </span>
            <div className="footer-spacer" />
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={safeClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary"
              disabled={busy || !preview || !accepted.size}
            >
              {busy ? "Saving…" : "Save accepted changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
