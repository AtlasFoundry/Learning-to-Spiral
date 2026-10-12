import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  FileText,
  Image,
  Library as LibraryIcon,
  Link2,
  LoaderCircle,
  Plus,
  Quote as QuoteIcon,
  Search,
  Settings,
  Sparkles,
  Upload,
  X,
  Trash2,
  ExternalLink,
  CircleHelp,
} from "lucide-react";
import {
  backupLibrary,
  download,
  emptyLibrary,
  id,
  lessonBundle,
  lessonExport,
  loadLibrary,
  researchStatuses,
  restoreLibrary,
  safeUrl,
  saveLibrary,
  sourceTypes,
  uses,
  visualStatuses,
  type Attachment,
  type Lesson,
  type Library,
  type Quote,
  type Source,
  type Visual,
} from "./library";

type Tab = "Research" | "Quotes & Extracts" | "Diagrams & Visuals";
type Modal =
  | { kind: "source"; value: Source }
  | { kind: "quote"; value: Quote }
  | { kind: "visual"; value: Visual }
  | { kind: "lesson" }
  | { kind: "settings" }
  | { kind: "link"; tab: Tab }
  | { kind: "export"; lesson: Lesson }
  | { kind: "restore"; library: Library };
const tabs: { name: Tab; icon: typeof BookOpen }[] = [
  { name: "Research", icon: BookOpen },
  { name: "Quotes & Extracts", icon: QuoteIcon },
  { name: "Diagrams & Visuals", icon: Image },
];
const newSource = (lessonId?: string): Source => ({
  id: id(),
  title: "",
  author: "",
  year: "",
  type: "Research paper",
  url: "",
  reference: "",
  findings: "",
  notes: "",
  status: "To read",
  lessonIds: lessonId ? [lessonId] : [],
  attachmentIds: [],
});
const newQuote = (lessonId?: string): Quote => ({
  id: id(),
  text: "",
  sourceId: "",
  reference: "",
  point: "",
  commentary: "",
  use: "General reference",
  lessonIds: lessonId ? [lessonId] : [],
});
const newVisual = (lessonId?: string): Visual => ({
  id: id(),
  title: "",
  description: "",
  concept: "",
  placement: "",
  status: "Idea",
  notes: "",
  url: "",
  attachmentId: "",
  lessonIds: lessonId ? [lessonId] : [],
});
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
  hint?: string;
}) {
  const fieldId = useId();
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      {cloneElement(children, { id: fieldId })}
      {hint && <small>{hint}</small>}
    </div>
  );
}
function Select({
  value,
  onChange,
  options,
  label,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  label?: string;
  id?: string;
}) {
  return (
    <select
      id={id}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}
function Tag({ children }: { children: ReactNode }) {
  return <span className="tag">{children}</span>;
}
function FilePreview({
  attachment,
  external,
  title,
}: {
  attachment?: Attachment;
  external?: string;
  title: string;
}) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (!attachment) {
      setUrl(safeUrl(external || "") || "");
      return;
    }
    const url = URL.createObjectURL(attachment.blob);
    setUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment, external]);
  return (
    <div className="visual-preview">
      {url && !failed ? (
        <img
          src={url}
          alt={title}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <>
          <Image size={28} strokeWidth={1.2} />
          <span>
            {failed
              ? "Preview unavailable"
              : "A visual idea, waiting to take shape"}
          </span>
        </>
      )}
    </div>
  );
}
function LinkedLessons({
  library,
  ids,
  onChange,
}: {
  library: Library;
  ids: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset className="lesson-links">
      <legend>Linked lessons</legend>
      <p className="muted small">
        Keep one master record. Link it wherever it helps.
      </p>
      {library.lessons.length ? (
        <div className="check-list">
          {library.lessons.map((l) => (
            <label key={l.id}>
              <input
                type="checkbox"
                checked={ids.includes(l.id)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...ids, l.id]
                      : ids.filter((v) => v !== l.id),
                  )
                }
              />
              <span>
                {l.title}
                <small>
                  {library.pillars.find((p) => p.id === l.pillarId)?.name}
                </small>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="muted small">
          Create a lesson to link this material later.
        </p>
      )}
    </fieldset>
  );
}

export default function App() {
  const [library, setLibrary] = useState<Library>(emptyLibrary);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveStatus, setSaveStatus] = useState("Saved locally");
  const saveSequence = useRef(0);
  const [view, setView] = useState<"lessons" | "library" | "editor">("lessons");
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState<Tab>("Research");
  const [pillar, setPillar] = useState("all");
  const [lessonFilter, setLessonFilter] = useState("all");
  const [useFilter, setUseFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<Modal | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const lesson = library.lessons.find((l) => l.id === selectedId);
  useEffect(() => {
    if (loaded && view === "editor" && !lesson) setView("lessons");
  }, [loaded, view, lesson]);
  useEffect(() => {
    let active = true;
    loadLibrary()
      .then((data) => {
        if (active) {
          setLibrary(data);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active)
          setLoadError(
            "Browser storage could not be opened. Enable IndexedDB for this site and reload. Your saved data has not been replaced.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const sequence = ++saveSequence.current;
    setSaveStatus("Saving…");
    saveLibrary(library)
      .then(() => {
        if (sequence === saveSequence.current) setSaveStatus("Saved locally");
      })
      .catch(() => {
        if (sequence === saveSequence.current)
          setSaveStatus("Save failed — download a backup");
      });
  }, [library, loaded]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (saveStatus !== "Saved locally") {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveStatus]);
  const updateLesson = (patch: Partial<Lesson>) =>
    setLibrary((previous) => ({
      ...previous,
      lessons: previous.lessons.map((l) =>
        l.id === selectedId ? { ...l, ...patch } : l,
      ),
    }));
  const navigate = (next: typeof view) => {
    setView(next);
    setSearch("");
    setLessonFilter("all");
    setPillar("all");
  };
  const openLesson = (l: Lesson) => {
    setSelectedId(l.id);
    setView("editor");
    setSearch("");
  };
  const add = (which = tab) =>
    setModal(
      which === "Research"
        ? {
            kind: "source",
            value: newSource(view === "editor" ? selectedId : undefined),
          }
        : which === "Quotes & Extracts"
          ? {
              kind: "quote",
              value: newQuote(view === "editor" ? selectedId : undefined),
            }
          : {
              kind: "visual",
              value: newVisual(view === "editor" ? selectedId : undefined),
            },
    );
  const backup = async () => {
    setBusy(true);
    try {
      download(
        `learning-to-spiral-backup-${new Date().toISOString().slice(0, 10)}.json`,
        new Blob([await backupLibrary(library)], { type: "application/json" }),
      );
      setNotice("Portable backup downloaded, including all uploaded files.");
    } catch {
      setNotice("Backup failed. Please retry before closing the studio.");
    } finally {
      setBusy(false);
    }
  };
  const importBackup = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > 150 * 1024 * 1024)
        throw new Error("Backup is too large (150 MB maximum).");
      setModal({
        kind: "restore",
        library: await restoreLibrary(await file.text()),
      });
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not read the backup.",
      );
    } finally {
      setBusy(false);
      if (importInput.current) importInput.current.value = "";
    }
  };
  const linked = (item: { lessonIds: string[] }) => {
    if (view === "editor") return item.lessonIds.includes(selectedId);
    if (lessonFilter !== "all" && !item.lessonIds.includes(lessonFilter))
      return false;
    if (
      pillar !== "all" &&
      !item.lessonIds.some((link) =>
        library.lessons.some((l) => l.id === link && l.pillarId === pillar),
      )
    )
      return false;
    return true;
  };
  const matches = (values: string[]) =>
    !search || values.join(" ").toLowerCase().includes(search.toLowerCase());
  const effectiveSource = (source: Source) => ({
    ...source,
    lessonIds: [
      ...new Set([
        ...source.lessonIds,
        ...library.quotes
          .filter((q) => q.sourceId === source.id)
          .flatMap((q) => q.lessonIds),
      ]),
    ],
  });
  const sources = library.sources.filter(
    (s) =>
      linked(effectiveSource(s)) &&
      matches([s.title, s.author, s.findings, s.notes]),
  );
  const quotes = library.quotes.filter(
    (q) =>
      linked(q) &&
      (useFilter === "all" || q.use === useFilter) &&
      matches([
        q.text,
        q.point,
        q.commentary,
        library.sources.find((s) => s.id === q.sourceId)?.title || "",
      ]),
  );
  const visuals = library.visuals.filter(
    (v) => linked(v) && matches([v.title, v.description, v.concept, v.notes]),
  );
  const total =
    tab === "Research"
      ? sources.length
      : tab === "Quotes & Extracts"
        ? quotes.length
        : visuals.length;
  const label =
    tab === "Research"
      ? "research"
      : tab === "Quotes & Extracts"
        ? "quote"
        : "diagram";
  const counts = (name: Tab) =>
    name === "Research"
      ? library.sources.filter(
          (s) =>
            view !== "editor" ||
            effectiveSource(s).lessonIds.includes(selectedId),
        ).length
      : name === "Quotes & Extracts"
        ? library.quotes.filter(
            (q) => view !== "editor" || q.lessonIds.includes(selectedId),
          ).length
        : library.visuals.filter(
            (v) => view !== "editor" || v.lessonIds.includes(selectedId),
          ).length;
  const deleteEntry = (
    kind: "source" | "quote" | "visual",
    entryId: string,
  ) => {
    if (
      kind === "source" &&
      library.quotes.some((q) => q.sourceId === entryId)
    ) {
      setNotice(
        "This source has linked quotes. Remove or reassign those quotes first to preserve attribution.",
      );
      return;
    }
    if (
      !window.confirm(
        "Delete this master entry from all lessons? This cannot be undone without a backup.",
      )
    )
      return;
    setLibrary((previous) => {
      const next = {
        ...previous,
        sources:
          kind === "source"
            ? previous.sources.filter((s) => s.id !== entryId)
            : previous.sources,
        quotes:
          kind === "quote"
            ? previous.quotes.filter((q) => q.id !== entryId)
            : previous.quotes,
        visuals:
          kind === "visual"
            ? previous.visuals.filter((v) => v.id !== entryId)
            : previous.visuals,
      };
      const used = new Set([
        ...next.sources.flatMap((s) => s.attachmentIds),
        ...next.visuals.map((v) => v.attachmentId),
      ]);
      return {
        ...next,
        attachments: next.attachments.filter((a) => used.has(a.id)),
      };
    });
    setModal(null);
  };
  if (!loaded)
    return (
      <div className="loading">
        <Sparkles size={32} />
        <h1>Learning to Spiral</h1>
        <p role={loadError ? "alert" : "status"}>
          {loadError || "Opening your studio…"}
        </p>
        {loadError && (
          <button onClick={() => location.reload()}>Try again</button>
        )}
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("lessons");
          }}
        >
          <span className="brand-mark">◎</span>
          <span>
            Learning <br />
            to Spiral<small>LESSON STUDIO</small>
          </span>
        </a>
        <div className="nav-label">YOUR WORKSPACE</div>
        <nav>
          <button
            className={view !== "library" ? "active" : ""}
            onClick={() => navigate("lessons")}
          >
            <BookOpen size={18} />
            Lesson Studio<span>{library.lessons.length}</span>
          </button>
          <button
            className={view === "library" ? "active" : ""}
            onClick={() => navigate("library")}
          >
            <LibraryIcon size={18} />
            Research & Visuals
          </button>
        </nav>
        <div className="nav-label pillar-label">
          THE NINE PILLARS
          <button
            aria-label="Edit pillar names"
            onClick={() => setModal({ kind: "settings" })}
          >
            <Settings size={14} />
          </button>
        </div>
        <div className="pillar-nav">
          {library.pillars.map((p, i) => (
            <button
              className={pillar === p.id && view !== "editor" ? "selected" : ""}
              key={p.id}
              onClick={() => {
                if (view === "editor") setView("lessons");
                setPillar(pillar === p.id ? "all" : p.id);
                setLessonFilter("all");
              }}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              {p.name}
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="local-note">
            <span className="status-dot" />
            Your private, local workspace
          </div>
          <button onClick={backup} disabled={busy}>
            <Download size={16} />
            Download backup
          </button>
          <button onClick={() => importInput.current?.click()} disabled={busy}>
            <Upload size={16} />
            Restore backup
          </button>
          <p>
            Build your library.
            <br />
            Let your teaching unfold.
          </p>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            Workspace
            <ChevronRight size={14} />
            <span>
              {view === "library"
                ? "Research & Visual Library"
                : view === "editor"
                  ? "Lesson editor"
                  : "Lesson Studio"}
            </span>
          </div>
          <span
            className={`save-status ${saveStatus.startsWith("Save failed") ? "error" : ""}`}
            role="status"
          >
            {saveStatus === "Saved locally" ? (
              <Check size={14} />
            ) : (
              <LoaderCircle size={14} />
            )}
            {saveStatus}
          </span>
          <details className="mobile-tools">
            <summary aria-label="Workspace tools">
              <Settings size={17} />
            </summary>
            <div>
              <button disabled={busy} onClick={backup}>
                <Download size={14} />
                Download backup
              </button>
              <button
                disabled={busy}
                onClick={() => importInput.current?.click()}
              >
                <Upload size={14} />
                Restore backup
              </button>
              <button onClick={() => setModal({ kind: "settings" })}>
                <Settings size={14} />
                Edit pillar names
              </button>
            </div>
          </details>
        </header>
        <main>
          {view === "lessons" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">A PRACTICE OF UNDERSTANDING</div>
                  <h1>Your Lesson Studio</h1>
                  <p>
                    A place to gather your thinking, connect ideas, and shape
                    what comes next.
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => setModal({ kind: "lesson" })}
                >
                  <Plus size={17} />
                  New lesson
                </button>
              </div>
              <div className="studio-intro">
                <div className="intro-symbol">◎</div>
                <div>
                  <span className="eyebrow">ONE IDEA BECOMES MANY</span>
                  <h2>Make room for deeper learning.</h2>
                  <p>
                    Your lessons and their supporting research, quotes, and
                    visuals grow together.
                  </p>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("library")}
                >
                  Explore your library
                  <ArrowRight size={16} />
                </button>
              </div>
              <div className="section-heading">
                <h2>
                  {pillar === "all"
                    ? "All lessons"
                    : library.pillars.find((p) => p.id === pillar)?.name}
                  <span className="count">
                    {
                      library.lessons.filter(
                        (l) => pillar === "all" || l.pillarId === pillar,
                      ).length
                    }
                  </span>
                </h2>
                <label className="search">
                  <Search size={16} />
                  <input
                    placeholder="Find a lesson…"
                    aria-label="Find a lesson"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              <div className="lesson-grid">
                {library.lessons
                  .filter(
                    (l) =>
                      (pillar === "all" || l.pillarId === pillar) &&
                      matches([l.title, l.summary]),
                  )
                  .map((l) => (
                    <button
                      className="lesson-card"
                      key={l.id}
                      onClick={() => openLesson(l)}
                    >
                      <div className="card-kicker">
                        <span>
                          {
                            library.pillars.find((p) => p.id === l.pillarId)
                              ?.name
                          }
                        </span>
                        <ArrowRight size={17} />
                      </div>
                      <h3>{l.title}</h3>
                      <p>
                        {l.summary ||
                          "An idea ready to unfold. Add an overview in the lesson editor."}
                      </p>
                      <div className="card-footer">
                        <BookOpen size={14} />
                        {
                          library.sources.filter((s) =>
                            effectiveSource(s).lessonIds.includes(l.id),
                          ).length
                        }{" "}
                        sources<span>·</span>
                        {
                          library.visuals.filter((v) =>
                            v.lessonIds.includes(l.id),
                          ).length
                        }{" "}
                        visuals
                      </div>
                    </button>
                  ))}
              </div>
              {!library.lessons.filter(
                (l) =>
                  (pillar === "all" || l.pillarId === pillar) &&
                  matches([l.title, l.summary]),
              ).length && (
                <div className="empty-state">
                  <BookOpen size={32} strokeWidth={1.3} />
                  <h3>
                    {search ? "No lessons found" : "Begin with a single idea"}
                  </h3>
                  <p>
                    {search
                      ? "Try a different title or overview."
                      : "Create your first lesson. Its research library will be right there when you need it."}
                  </p>
                  {!search && (
                    <button
                      className="primary"
                      onClick={() => setModal({ kind: "lesson" })}
                    >
                      <Plus size={16} />
                      Create a lesson
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          {view === "editor" && lesson && (
            <>
              <button className="back-link" onClick={() => navigate("lessons")}>
                <ArrowLeft size={15} />
                All lessons
              </button>
              <div className="page-heading editor-heading">
                <div>
                  <div className="eyebrow">YOUR IDEAS, TAKING SHAPE</div>
                  <h1>{lesson.title}</h1>
                </div>
                <button
                  className="secondary"
                  onClick={() => setModal({ kind: "export", lesson })}
                >
                  <Sparkles size={16} />
                  Export for ChatGPT
                </button>
              </div>
              <section className="lesson-editor">
                <div className="editor-row">
                  <Field label="Lesson title">
                    <input
                      value={lesson.title}
                      onChange={(e) => updateLesson({ title: e.target.value })}
                    />
                  </Field>
                  <Field label="Pillar">
                    <select
                      value={lesson.pillarId}
                      onChange={(e) =>
                        updateLesson({ pillarId: e.target.value })
                      }
                    >
                      {library.pillars.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Lesson overview">
                  <textarea
                    rows={2}
                    placeholder="What understanding do you want to open up?"
                    value={lesson.summary}
                    onChange={(e) => updateLesson({ summary: e.target.value })}
                  />
                </Field>
                <Field label="Teaching notes">
                  <textarea
                    className="teaching-area"
                    rows={6}
                    placeholder="Develop the ideas, questions, and structure of your lesson…"
                    value={lesson.content}
                    onChange={(e) => updateLesson({ content: e.target.value })}
                  />
                </Field>
                <details className="personal-notes">
                  <summary>My reflections & notes</summary>
                  <textarea
                    aria-label="My reflections and notes"
                    rows={3}
                    value={lesson.notes}
                    placeholder="A thought to return to…"
                    onChange={(e) => updateLesson({ notes: e.target.value })}
                  />
                </details>
              </section>
              <div className="library-heading">
                <div>
                  <h2>Lesson Library</h2>
                  <p>Supporting material, connected to this lesson.</p>
                </div>
                <span className="small muted">
                  <Link2 size={14} />
                  Linked to this lesson only
                </span>
              </div>
            </>
          )}
          {view === "library" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">A CUMULATIVE COLLECTION</div>
                  <h1>Research & Visual Library</h1>
                  <p>
                    The ideas behind your teaching. One collection, connected
                    across all nine pillars.
                  </p>
                </div>
                <button className="secondary" onClick={backup} disabled={busy}>
                  <Download size={16} />
                  Back up library
                </button>
              </div>
              <div className="library-summary">
                <span>
                  <strong>{library.sources.length}</strong> research sources
                </span>
                <span>
                  <strong>{library.quotes.length}</strong> quotes & extracts
                </span>
                <span>
                  <strong>{library.visuals.length}</strong> diagrams & visuals
                </span>
                <span className="summary-note">
                  <Link2 size={15} />
                  Collect once. Connect often.
                </span>
              </div>
            </>
          )}
          {(view === "library" || (view === "editor" && lesson)) && (
            <section className="library-section">
              <div className="tabs" role="tablist" aria-label="Lesson library">
                {tabs.map(({ name, icon: Icon }) => (
                  <button
                    key={name}
                    role="tab"
                    id={`tab-${name}`}
                    aria-controls="library-panel"
                    aria-selected={tab === name}
                    className={tab === name ? "active" : ""}
                    onClick={() => {
                      setTab(name);
                      setSearch("");
                      setUseFilter("all");
                    }}
                  >
                    <Icon size={16} />
                    {name}
                    <span>{counts(name)}</span>
                  </button>
                ))}
              </div>
              <div className="library-toolbar">
                <label className="search">
                  <Search size={16} />
                  <input
                    placeholder={`Search ${tab === "Research" ? "sources" : tab === "Quotes & Extracts" ? "quotes" : "visuals"}…`}
                    aria-label="Search library"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <div className="toolbar-actions">
                  {view === "library" && (
                    <>
                      <select
                        aria-label="Filter by pillar"
                        value={pillar}
                        onChange={(e) => {
                          setPillar(e.target.value);
                          setLessonFilter("all");
                        }}
                      >
                        <option value="all">All pillars</option>
                        {library.pillars.map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Filter by lesson"
                        value={lessonFilter}
                        onChange={(e) => setLessonFilter(e.target.value)}
                      >
                        <option value="all">All lessons</option>
                        {library.lessons
                          .filter(
                            (l) => pillar === "all" || l.pillarId === pillar,
                          )
                          .map((l) => (
                            <option value={l.id} key={l.id}>
                              {l.title}
                            </option>
                          ))}
                      </select>
                    </>
                  )}
                  {tab === "Quotes & Extracts" && (
                    <select
                      aria-label="Filter by intended use"
                      value={useFilter}
                      onChange={(e) => setUseFilter(e.target.value)}
                    >
                      <option value="all">All uses</option>
                      {uses.map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  )}
                  {view === "editor" && (
                    <button
                      className="text-button"
                      onClick={() => setModal({ kind: "link", tab })}
                    >
                      <Link2 size={15} />
                      Link existing
                    </button>
                  )}
                  <button
                    className="primary small-button"
                    onClick={() => add()}
                  >
                    <Plus size={16} />
                    Add {label}
                  </button>
                </div>
              </div>
              <div
                role="tabpanel"
                id="library-panel"
                aria-labelledby={`tab-${tab}`}
              >
                <div
                  className={
                    tab === "Diagrams & Visuals"
                      ? "visual-grid"
                      : "resource-list"
                  }
                >
                  {tab === "Research" &&
                    sources.map((s) => (
                      <article className="source-card" key={s.id}>
                        <div className="source-icon">
                          <BookOpen size={21} strokeWidth={1.5} />
                        </div>
                        <div className="resource-body">
                          <div className="card-kicker">
                            <span>
                              {s.type}
                              {s.year && ` · ${s.year}`}
                            </span>
                            <Tag>{s.status}</Tag>
                          </div>
                          <button
                            className="card-title"
                            onClick={() =>
                              setModal({ kind: "source", value: s })
                            }
                          >
                            {s.title}
                          </button>
                          <p className="author">
                            {s.author || "Author not recorded"}
                            {s.reference && ` · ${s.reference}`}
                          </p>
                          {s.findings && (
                            <p className="excerpt">{s.findings}</p>
                          )}
                          <div className="resource-foot">
                            <span>
                              <Link2 size={13} />
                              {effectiveSource(s).lessonIds.length} linked{" "}
                              {effectiveSource(s).lessonIds.length === 1
                                ? "lesson"
                                : "lessons"}
                            </span>
                            {safeUrl(s.url) && (
                              <a
                                href={safeUrl(s.url)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View source
                                <ExternalLink size={12} />
                              </a>
                            )}
                            <button
                              onClick={() =>
                                setModal({ kind: "source", value: s })
                              }
                            >
                              Edit
                              <ChevronRight size={13} />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  {tab === "Quotes & Extracts" &&
                    quotes.map((q) => {
                      const s = library.sources.find(
                        (s) => s.id === q.sourceId,
                      );
                      return (
                        <article className="quote-card" key={q.id}>
                          <QuoteIcon
                            className="quote-mark"
                            size={25}
                            strokeWidth={1.3}
                          />
                          <div className="resource-body">
                            <div className="card-kicker">
                              <span>{q.use}</span>
                              <button
                                className="text-button"
                                onClick={() =>
                                  setModal({ kind: "quote", value: q })
                                }
                              >
                                Edit
                                <ChevronRight size={13} />
                              </button>
                            </div>
                            <blockquote>{q.text}</blockquote>
                            <p className="author">
                              {s?.author || "Author not recorded"} ·{" "}
                              <button
                                className="inline-link"
                                onClick={() =>
                                  s && setModal({ kind: "source", value: s })
                                }
                              >
                                {s?.title}
                              </button>
                              {q.reference && ` · ${q.reference}`}
                            </p>
                            {q.point && (
                              <p className="excerpt">
                                <span className="muted">Teaching point:</span>{" "}
                                {q.point}
                              </p>
                            )}
                            <div className="resource-foot">
                              <span>
                                <Link2 size={13} />
                                {q.lessonIds.length} linked{" "}
                                {q.lessonIds.length === 1
                                  ? "lesson"
                                  : "lessons"}
                              </span>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  {tab === "Diagrams & Visuals" &&
                    visuals.map((v) => (
                      <article className="visual-card" key={v.id}>
                        <button
                          className="preview-button"
                          aria-label={`Edit ${v.title}`}
                          onClick={() => setModal({ kind: "visual", value: v })}
                        >
                          <FilePreview
                            attachment={library.attachments.find(
                              (a) => a.id === v.attachmentId,
                            )}
                            external={v.url}
                            title={v.title}
                          />
                        </button>
                        <div className="visual-body">
                          <div className="card-kicker">
                            <span>{v.concept || "Teaching visual"}</span>
                            <Tag>{v.status}</Tag>
                          </div>
                          <button
                            className="card-title"
                            onClick={() =>
                              setModal({ kind: "visual", value: v })
                            }
                          >
                            {v.title}
                          </button>
                          {v.description && (
                            <p className="excerpt">{v.description}</p>
                          )}
                          <div className="resource-foot">
                            <span>
                              <Link2 size={13} />
                              {v.lessonIds.length} linked{" "}
                              {v.lessonIds.length === 1 ? "lesson" : "lessons"}
                            </span>
                            <button
                              onClick={() =>
                                setModal({ kind: "visual", value: v })
                              }
                            >
                              Edit
                              <ChevronRight size={13} />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                </div>
                {!total && (
                  <div className="empty-state compact">
                    {tab === "Research" ? (
                      <BookOpen size={28} strokeWidth={1.3} />
                    ) : tab === "Quotes & Extracts" ? (
                      <QuoteIcon size={28} strokeWidth={1.3} />
                    ) : (
                      <Image size={28} strokeWidth={1.3} />
                    )}
                    <h3>
                      {search ||
                      pillar !== "all" ||
                      lessonFilter !== "all" ||
                      useFilter !== "all"
                        ? "No matching material"
                        : tab === "Research"
                          ? "Give your ideas a foundation"
                          : tab === "Quotes & Extracts"
                            ? "Keep the words that stay with you"
                            : "Make an idea visible"}
                    </h3>
                    <p>
                      {view === "editor"
                        ? "Add new material or link an existing entry from your library."
                        : "Collect once, then reuse across your lessons."}
                    </p>
                  </div>
                )}
              </div>
              <p className="library-footnote">
                <CircleHelp size={14} />
                {view === "editor"
                  ? "Entries stay in your central library and can support more than one lesson."
                  : "Your library stays in this browser. Download a backup to keep it portable and safe."}
              </p>
            </section>
          )}
          <footer className="page-footer">
            <span>LEARNING TO SPIRAL</span>
            <span>Thoughtful teaching begins with curiosity.</span>
          </footer>
        </main>
      </div>
      <input
        type="file"
        accept=".json,application/json"
        hidden
        ref={importInput}
        aria-label="Import portable backup"
        onChange={(e) => importBackup(e.target.files?.[0])}
      />
      {notice && (
        <div className="toast" role="alert">
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {modal && (
        <ModalContent
          key={modal.kind + ("value" in modal ? modal.value.id : "")}
          modal={modal}
          library={library}
          close={() => setModal(null)}
          setLibrary={setLibrary}
          setNotice={setNotice}
          openLesson={openLesson}
          selectedId={view === "editor" ? selectedId : ""}
          deleteEntry={deleteEntry}
        />
      )}
    </div>
  );
}

function ModalContent({
  modal,
  library,
  close,
  setLibrary,
  setNotice,
  openLesson,
  selectedId,
  deleteEntry,
}: {
  modal: Modal;
  library: Library;
  close: () => void;
  setLibrary: React.Dispatch<React.SetStateAction<Library>>;
  setNotice: (v: string) => void;
  openLesson: (l: Lesson) => void;
  selectedId: string;
  deleteEntry: (kind: "source" | "quote" | "visual", id: string) => void;
}) {
  const [source, setSource] = useState(
    modal.kind === "source" ? modal.value : newSource(),
  );
  const [quote, setQuote] = useState(
    modal.kind === "quote" ? modal.value : newQuote(),
  );
  const [visual, setVisual] = useState(
    modal.kind === "visual" ? modal.value : newVisual(),
  );
  const [files, setFiles] = useState<Attachment[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [pillarId, setPillarId] = useState(library.pillars[0].id);
  const [pillars, setPillars] = useState(library.pillars);
  const [chosen, setChosen] = useState<string[]>(
    modal.kind === "link"
      ? (modal.tab === "Research"
          ? library.sources
          : modal.tab === "Quotes & Extracts"
            ? library.quotes
            : library.visuals
        )
          .filter((item) => item.lessonIds.includes(selectedId))
          .map((item) => item.id)
      : [],
  );
  const [linkSearch, setLinkSearch] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const oldFocus = document.activeElement as HTMLElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current!;
    const first = dialog.querySelector<HTMLElement>(
      "input, textarea, select, button",
    );
    first?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const nodes = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            "button:not([disabled]), input:not([disabled]), textarea, select, a[href]",
          ),
        ).filter((n) => n.getClientRects().length);
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", keydown);
      oldFocus?.focus();
    };
  }, []);
  const isEntry = ["source", "quote", "visual"].includes(modal.kind);
  const existing =
    modal.kind === "source"
      ? library.sources.some((s) => s.id === source.id)
      : modal.kind === "quote"
        ? library.quotes.some((q) => q.id === quote.id)
        : modal.kind === "visual"
          ? library.visuals.some((v) => v.id === visual.id)
          : false;
  const heading =
    modal.kind === "source"
      ? `${existing ? "Edit" : "Add"} research`
      : modal.kind === "quote"
        ? `${existing ? "Edit" : "Add"} quote`
        : modal.kind === "visual"
          ? `${existing ? "Edit" : "Add"} diagram`
          : modal.kind === "lesson"
            ? "A new lesson"
            : modal.kind === "settings"
              ? "Your nine pillars"
              : modal.kind === "link"
                ? "Link from your library"
                : modal.kind === "export"
                  ? "Export for ChatGPT"
                  : "Restore your workspace";
  const allFiles = [...library.attachments, ...files];
  const addFiles = (list: FileList | null, imageOnly: boolean) => {
    if (!list?.length) return;
    const selected = Array.from(list);
    if (selected.some((f) => f.size > 10 * 1024 * 1024)) {
      setError("Each file must be 10 MB or smaller.");
      return;
    }
    if (
      imageOnly &&
      selected.some(
        (f) => !["image/png", "image/jpeg", "image/svg+xml"].includes(f.type),
      )
    ) {
      setError("Choose a PNG, JPG, or SVG image.");
      return;
    }
    const newFiles = selected.map((f) => ({
      id: id(),
      name: f.name,
      mime: f.type || "application/octet-stream",
      blob: f,
    }));
    setFiles((previous) => [...previous, ...newFiles]);
    if (imageOnly) setVisual((v) => ({ ...v, attachmentId: newFiles[0].id }));
    else
      setSource((s) => ({
        ...s,
        attachmentIds: [...s.attachmentIds, ...newFiles.map((f) => f.id)],
      }));
    setError("");
  };
  const commit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (modal.kind === "source" && source.url && !safeUrl(source.url)) {
      setError("Use an http/https URL or a DOI such as 10.1234/example.");
      return;
    }
    if (modal.kind === "visual" && visual.url && !safeUrl(visual.url)) {
      setError("Use an http/https URL for an external visual.");
      return;
    }
    if (
      (modal.kind === "source" && !source.title.trim()) ||
      (modal.kind === "visual" && !visual.title.trim()) ||
      (modal.kind === "quote" && !quote.text.trim()) ||
      (modal.kind === "lesson" && !title.trim())
    ) {
      setError("Please enter a title or quotation.");
      return;
    }
    if (modal.kind === "quote" && !quote.sourceId) {
      setError(
        "Select the original research entry to preserve attribution. Add it under Research first.",
      );
      return;
    }
    if (modal.kind === "settings" && pillars.some((p) => !p.name.trim())) {
      setError("Each pillar needs a name.");
      return;
    }
    if (modal.kind === "restore") {
      setBusy(true);
      try {
        await saveLibrary(modal.library);
        setLibrary(modal.library);
        setNotice("Workspace restored, including uploaded files.");
        close();
      } catch {
        setError(
          "Restore could not be saved. Your current workspace is unchanged. Check browser storage space.",
        );
      } finally {
        setBusy(false);
      }
      return;
    }
    if (modal.kind === "lesson") {
      const lesson: Lesson = {
        id: id(),
        title: title.trim(),
        pillarId,
        summary: "",
        content: "",
        notes: "",
      };
      setLibrary((previous) => ({
        ...previous,
        lessons: [...previous.lessons, lesson],
      }));
      close();
      openLesson(lesson);
      return;
    }
    if (modal.kind === "settings") {
      setLibrary((previous) => ({ ...previous, pillars }));
      close();
      return;
    }
    if (modal.kind === "link") {
      setLibrary((previous) => {
        const link = <T extends { id: string; lessonIds: string[] }>(
          items: T[],
        ) =>
          items.map((item) => ({
            ...item,
            lessonIds: [
              ...item.lessonIds.filter((l) => l !== selectedId),
              ...(chosen.includes(item.id) ? [selectedId] : []),
            ],
          }));
        return {
          ...previous,
          sources:
            modal.tab === "Research"
              ? link(previous.sources)
              : previous.sources,
          quotes:
            modal.tab === "Quotes & Extracts"
              ? link(previous.quotes)
              : previous.quotes,
          visuals:
            modal.tab === "Diagrams & Visuals"
              ? link(previous.visuals)
              : previous.visuals,
        };
      });
      close();
      return;
    }
    if (isEntry) {
      setLibrary((previous) => {
        const upsert = <T extends { id: string }>(list: T[], entry: T) =>
          list.some((e) => e.id === entry.id)
            ? list.map((e) => (e.id === entry.id ? entry : e))
            : [...list, entry];
        const sources =
          modal.kind === "source"
            ? upsert(previous.sources, source)
            : previous.sources;
        const quotes =
          modal.kind === "quote"
            ? upsert(previous.quotes, quote)
            : previous.quotes;
        const visuals =
          modal.kind === "visual"
            ? upsert(previous.visuals, visual)
            : previous.visuals;
        const used = new Set([
          ...sources.flatMap((s) => s.attachmentIds),
          ...visuals.map((v) => v.attachmentId),
        ]);
        return {
          ...previous,
          sources,
          quotes,
          visuals,
          attachments: [...previous.attachments, ...files].filter((a) =>
            used.has(a.id),
          ),
        };
      });
      close();
    }
  };
  const exportFiles = async (format: "text" | "portable") => {
    if (modal.kind !== "export") return;
    setBusy(true);
    try {
      const stem =
        modal.lesson.title.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) ||
        "lesson";
      if (format === "text")
        download(
          `${stem}-chatgpt.md`,
          new Blob([lessonExport(library, modal.lesson)], {
            type: "text/markdown",
          }),
        );
      else
        download(
          `${stem}-with-attachments.json`,
          new Blob([await backupLibrary(lessonBundle(library, modal.lesson))], {
            type: "application/json",
          }),
        );
    } catch {
      setError("Export failed. Please retry.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={dialogRef}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">
              {isEntry ? "YOUR CUMULATIVE LIBRARY" : "LESSON STUDIO"}
            </span>
            <h2 id="modal-title">{heading}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={commit}>
          <div className="modal-body">
            {modal.kind === "lesson" && (
              <>
                <p className="muted">
                  Begin with a title. You can shape the rest as you go.
                </p>
                <Field label="Lesson title">
                  <input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="An idea to explore…"
                  />
                </Field>
                <Field label="Pillar">
                  <select
                    value={pillarId}
                    onChange={(e) => setPillarId(e.target.value)}
                  >
                    {library.pillars.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            {modal.kind === "settings" && (
              <>
                <p className="muted">
                  Name the nine pillars of your teaching practice.
                </p>
                <div className="pillar-fields">
                  {pillars.map((p, i) => (
                    <Field label={`Pillar ${i + 1}`} key={p.id}>
                      <input
                        required
                        value={p.name}
                        onChange={(e) =>
                          setPillars(
                            pillars.map((v) =>
                              v.id === p.id
                                ? { ...v, name: e.target.value }
                                : v,
                            ),
                          )
                        }
                      />
                    </Field>
                  ))}
                </div>
              </>
            )}
            {modal.kind === "source" && (
              <>
                <Field label="Title">
                  <input
                    required
                    value={source.title}
                    onChange={(e) =>
                      setSource({ ...source, title: e.target.value })
                    }
                    placeholder="The title of the original source"
                  />
                </Field>
                <div className="two-columns">
                  <Field label="Author">
                    <input
                      value={source.author}
                      onChange={(e) =>
                        setSource({ ...source, author: e.target.value })
                      }
                      placeholder="As credited in the source"
                    />
                  </Field>
                  <Field label="Publication year">
                    <input
                      value={source.year}
                      onChange={(e) =>
                        setSource({ ...source, year: e.target.value })
                      }
                      placeholder="Leave blank if unknown"
                    />
                  </Field>
                  <Field label="Source type">
                    <Select
                      value={source.type}
                      onChange={(type) => setSource({ ...source, type })}
                      options={[...sourceTypes]}
                    />
                  </Field>
                  <Field label="Verification status">
                    <Select
                      value={source.status}
                      onChange={(status) => setSource({ ...source, status })}
                      options={[...researchStatuses]}
                    />
                  </Field>
                </div>
                <Field label="URL or DOI">
                  <input
                    value={source.url}
                    onChange={(e) =>
                      setSource({ ...source, url: e.target.value })
                    }
                    placeholder="https://… or 10.…"
                  />
                </Field>
                <Field label="Chapter or page references">
                  <input
                    value={source.reference}
                    onChange={(e) =>
                      setSource({ ...source, reference: e.target.value })
                    }
                    placeholder="Chapter 3, pp. 42–48"
                  />
                </Field>
                <Field label="Key findings or relevant ideas">
                  <textarea
                    rows={3}
                    value={source.findings}
                    onChange={(e) =>
                      setSource({ ...source, findings: e.target.value })
                    }
                  />
                </Field>
                <Field label="My notes on how this relates to the lesson">
                  <textarea
                    rows={3}
                    value={source.notes}
                    onChange={(e) =>
                      setSource({ ...source, notes: e.target.value })
                    }
                  />
                </Field>
                <div className="attachment-field">
                  <span>Attachments</span>
                  <label className="upload-area">
                    <Upload size={19} />
                    <span>
                      Attach a paper, document, or image
                      <small>Up to 10 MB per file · included in backups</small>
                    </span>
                    <input
                      type="file"
                      multiple
                      aria-label="Upload source attachments"
                      onChange={(e) => {
                        addFiles(e.target.files, false);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {source.attachmentIds.map((a) => {
                    const file = allFiles.find((f) => f.id === a);
                    return (
                      file && (
                        <div className="attachment" key={a}>
                          <FileText size={15} />
                          <button
                            type="button"
                            className="inline-link"
                            onClick={() => download(file.name, file.blob)}
                          >
                            {file.name}
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove ${file.name}`}
                            onClick={() =>
                              setSource({
                                ...source,
                                attachmentIds: source.attachmentIds.filter(
                                  (v) => v !== a,
                                ),
                              })
                            }
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )
                    );
                  })}
                </div>
                <LinkedLessons
                  library={library}
                  ids={source.lessonIds}
                  onChange={(lessonIds) => setSource({ ...source, lessonIds })}
                />
              </>
            )}
            {modal.kind === "quote" && (
              <>
                <Field
                  label="Exact quotation"
                  hint="Transcribe faithfully. Attribution comes from the original research entry."
                >
                  <textarea
                    rows={4}
                    required
                    value={quote.text}
                    onChange={(e) =>
                      setQuote({ ...quote, text: e.target.value })
                    }
                    placeholder="The exact words from the source…"
                  />
                </Field>
                <Field label="Original research entry">
                  <select
                    required
                    value={quote.sourceId}
                    onChange={(e) =>
                      setQuote({ ...quote, sourceId: e.target.value })
                    }
                  >
                    <option value="">Select a source…</option>
                    {library.sources.map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.title}
                        {s.author && ` — ${s.author}`}
                      </option>
                    ))}
                  </select>
                </Field>
                {!library.sources.length && (
                  <p className="inline-notice">
                    Add the original source in the Research tab first. Missing
                    attribution is kept blank.
                  </p>
                )}
                {quote.sourceId && (
                  <p className="attribution">
                    Author:{" "}
                    {library.sources.find((s) => s.id === quote.sourceId)
                      ?.author || "Not recorded in original source"}
                  </p>
                )}
                <Field label="Page number, chapter, or section">
                  <input
                    value={quote.reference}
                    onChange={(e) =>
                      setQuote({ ...quote, reference: e.target.value })
                    }
                    placeholder="Leave blank if unknown"
                  />
                </Field>
                <Field label="The teaching point it supports">
                  <textarea
                    rows={2}
                    value={quote.point}
                    onChange={(e) =>
                      setQuote({ ...quote, point: e.target.value })
                    }
                  />
                </Field>
                <Field label="My interpretation or commentary">
                  <textarea
                    rows={3}
                    value={quote.commentary}
                    onChange={(e) =>
                      setQuote({ ...quote, commentary: e.target.value })
                    }
                  />
                </Field>
                <Field label="Intended use">
                  <Select
                    value={quote.use}
                    onChange={(use) => setQuote({ ...quote, use })}
                    options={[...uses]}
                  />
                </Field>
                <LinkedLessons
                  library={library}
                  ids={quote.lessonIds}
                  onChange={(lessonIds) => setQuote({ ...quote, lessonIds })}
                />
              </>
            )}
            {modal.kind === "visual" && (
              <>
                <Field label="Title">
                  <input
                    required
                    value={visual.title}
                    onChange={(e) =>
                      setVisual({ ...visual, title: e.target.value })
                    }
                    placeholder="A name for your visual"
                  />
                </Field>
                <div className="attachment-field">
                  <label className="upload-area">
                    <Image size={21} />
                    <span>
                      {visual.attachmentId
                        ? "Replace uploaded image"
                        : "Upload an image"}
                      <small>
                        PNG, JPG, SVG · up to 10 MB · stored in your backup
                      </small>
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      aria-label="Upload diagram image"
                      onChange={(e) => {
                        addFiles(e.target.files, true);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {visual.attachmentId && (
                    <>
                      <FilePreview
                        title={visual.title}
                        attachment={allFiles.find(
                          (a) => a.id === visual.attachmentId,
                        )}
                      />
                      <div className="attachment">
                        <span>
                          {
                            allFiles.find((a) => a.id === visual.attachmentId)
                              ?.name
                          }
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const file = allFiles.find(
                              (a) => a.id === visual.attachmentId,
                            );
                            if (file) download(file.name, file.blob);
                          }}
                        >
                          Download
                        </button>
                        <button
                          type="button"
                          aria-label="Remove uploaded image"
                          onClick={() =>
                            setVisual({ ...visual, attachmentId: "" })
                          }
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <Field
                  label="External image or diagram link"
                  hint="Direct image links show a preview. Other links are kept as references."
                >
                  <input
                    value={visual.url}
                    onChange={(e) =>
                      setVisual({ ...visual, url: e.target.value })
                    }
                    placeholder="https://…"
                  />
                </Field>
                {safeUrl(visual.url) && (
                  <a
                    href={safeUrl(visual.url)}
                    className="inline-link"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open external reference
                    <ExternalLink size={13} />
                  </a>
                )}
                <Field label="Description">
                  <textarea
                    rows={2}
                    value={visual.description}
                    onChange={(e) =>
                      setVisual({ ...visual, description: e.target.value })
                    }
                  />
                </Field>
                <Field label="Concept being illustrated">
                  <input
                    value={visual.concept}
                    onChange={(e) =>
                      setVisual({ ...visual, concept: e.target.value })
                    }
                  />
                </Field>
                <Field label="Where it will appear in the lesson">
                  <input
                    value={visual.placement}
                    onChange={(e) =>
                      setVisual({ ...visual, placement: e.target.value })
                    }
                    placeholder="Opening explanation, slide 4…"
                  />
                </Field>
                <Field label="Status">
                  <Select
                    value={visual.status}
                    onChange={(status) => setVisual({ ...visual, status })}
                    options={[...visualStatuses]}
                  />
                </Field>
                <Field label="Notes for revisions">
                  <textarea
                    rows={3}
                    value={visual.notes}
                    onChange={(e) =>
                      setVisual({ ...visual, notes: e.target.value })
                    }
                  />
                </Field>
                <LinkedLessons
                  library={library}
                  ids={visual.lessonIds}
                  onChange={(lessonIds) => setVisual({ ...visual, lessonIds })}
                />
              </>
            )}
            {modal.kind === "link" && (
              <>
                <p className="muted">
                  Choose material to support this lesson. Changes to a master
                  entry are shared across lessons.
                </p>
                <label className="search">
                  <Search size={16} />
                  <input
                    value={linkSearch}
                    placeholder="Find an entry…"
                    aria-label="Find an existing entry"
                    onChange={(e) => setLinkSearch(e.target.value)}
                  />
                </label>
                <div className="link-picker">
                  {(modal.tab === "Research"
                    ? library.sources
                    : modal.tab === "Quotes & Extracts"
                      ? library.quotes
                      : library.visuals
                  )
                    .filter((item) =>
                      ("text" in item ? item.text : item.title)
                        .toLowerCase()
                        .includes(linkSearch.toLowerCase()),
                    )
                    .map((item) => (
                      <label key={item.id}>
                        <input
                          type="checkbox"
                          checked={chosen.includes(item.id)}
                          onChange={(e) =>
                            setChosen(
                              e.target.checked
                                ? [...chosen, item.id]
                                : chosen.filter((v) => v !== item.id),
                            )
                          }
                        />
                        <span>
                          {"text" in item ? item.text : item.title}
                          <small>{item.lessonIds.length} linked lessons</small>
                        </span>
                      </label>
                    ))}
                </div>
                {!(
                  modal.tab === "Research"
                    ? library.sources
                    : modal.tab === "Quotes & Extracts"
                      ? library.quotes
                      : library.visuals
                ).length && (
                  <p className="muted">
                    No entries yet. Add your first entry from the lesson
                    library.
                  </p>
                )}
                {modal.tab === "Research" && (
                  <p className="small muted">
                    Sources referenced by a linked quote remain visible in the
                    lesson to preserve attribution.
                  </p>
                )}
              </>
            )}
            {modal.kind === "export" && (
              <>
                <p className="muted">
                  Your lesson, linked research, exact quotations, visual
                  descriptions, and personal notes — ready to use as context.
                </p>
                <div className="export-actions">
                  <button
                    type="button"
                    className="primary"
                    disabled={busy}
                    onClick={() => exportFiles("text")}
                  >
                    <Download size={16} />
                    Download ChatGPT text
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => exportFiles("portable")}
                  >
                    <Download size={16} />
                    Download with attachments
                  </button>
                </div>
                <p className="small muted">
                  The portable JSON embeds uploaded files. For ChatGPT, upload
                  the text plus relevant image/document files downloaded from
                  their entries. Missing source information is explicitly
                  marked.
                </p>
                <pre className="export-preview">
                  {lessonExport(library, modal.lesson)}
                </pre>
              </>
            )}
            {modal.kind === "restore" && (
              <>
                <p>
                  This backup contains{" "}
                  <strong>{modal.library.lessons.length} lessons</strong>,{" "}
                  {modal.library.sources.length} sources,{" "}
                  {modal.library.quotes.length} quotes,{" "}
                  {modal.library.visuals.length} visuals, and{" "}
                  <strong>
                    {modal.library.attachments.length} uploaded files
                  </strong>
                  .
                </p>
                <div className="inline-notice">
                  Restoring replaces your current workspace. Download a backup
                  of the current workspace before continuing if you want to keep
                  it.
                </div>
                <p className="small muted">
                  The backup has been validated. Images and attachments will be
                  restored into browser storage along with their original links.
                </p>
              </>
            )}
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
          </div>
          <div className="modal-footer">
            {isEntry && existing && (
              <button
                type="button"
                className="delete-button"
                onClick={() => {
                  if (
                    modal.kind === "source" ||
                    modal.kind === "quote" ||
                    modal.kind === "visual"
                  )
                    deleteEntry(modal.kind, modal.value.id);
                }}
              >
                <Trash2 size={15} />
                Delete
              </button>
            )}
            <div className="footer-spacer" />
            <button type="button" className="secondary" onClick={close}>
              {modal.kind === "export" ? "Done" : "Cancel"}
            </button>
            {modal.kind !== "export" && (
              <button className="primary" type="submit" disabled={busy}>
                {busy
                  ? "Saving…"
                  : modal.kind === "restore"
                    ? "Replace & restore"
                    : modal.kind === "lesson"
                      ? "Create lesson"
                      : modal.kind === "link"
                        ? "Save links"
                        : "Save changes"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
