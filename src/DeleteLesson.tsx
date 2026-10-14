import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { removeLesson, saveLibrary, type Library } from "./library";
import { useDialogFocus } from "./dialog";

export default function DeleteLesson({
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const safeClose = () => {
    if (!busy) close();
  };
  const dialogRef = useDialogFocus(safeClose);
  const lesson = library.lessons.find((lesson) => lesson.id === lessonId);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const next = removeLesson(library, lessonId);
      await saveLibrary(next);
      onSaved(next);
      notify(
        "Lesson deleted. Research, quotes, diagrams and uploaded files remain in your library.",
      );
      close();
    } catch {
      setError(
        "The lesson could not be deleted. Your saved workspace is unchanged. Retry or cancel.",
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
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-lesson-title"
        ref={dialogRef}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">LESSON STUDIO</span>
            <h2 id="delete-lesson-title">Delete lesson?</h2>
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
          <p>
            Delete <strong>{lesson?.title ?? "this lesson"}</strong> and its
            teaching content, personal notes and questions?
          </p>
          <p className="muted">
            Research, quotes, diagrams and uploaded files stay in your central
            library. Only their links to this lesson are removed. Other lessons
            stay intact.
          </p>
          <p className="small muted">
            You can recover the lesson from a portable backup made before
            deletion.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <div className="footer-spacer" />
          <button className="secondary" disabled={busy} onClick={safeClose}>
            Cancel
          </button>
          <button
            className="primary danger"
            disabled={busy || !lesson}
            onClick={confirm}
          >
            <Trash2 size={15} />
            {busy ? "Deleting…" : "Delete lesson"}
          </button>
        </div>
      </div>
    </div>
  );
}
