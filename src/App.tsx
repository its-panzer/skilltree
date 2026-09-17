import { useEffect, useRef, useState } from "react";
import {
  GitBranch,
  Library as LibraryIcon,
  Activity as ActivityIcon,
  Plug,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  Search,
  ShieldCheck,
  Crosshair,
  Lock,
  Check,
  X,
  BookOpen,
  LoaderCircle,
  Network,
} from "lucide-react";
import type { Catalog, Skill, Scope, Status, RouteResult } from "./types";
import { icons, colorStyle, date } from "./lib/display";
import { api } from "./lib/api";
import { ScopeSelect } from "./components/ScopeSelect";
import { SkillTree } from "./components/SkillTree";
import { RouteTrace } from "./components/RouteTrace";
import { ActivityPage } from "./components/ActivityPage";
import { AgentsPage } from "./components/AgentsPage";
import { SkillReader } from "./components/SkillReader";

export default function App() {
  const [page, setPageState] = useState(
      () =>
        ({
          "/skills": "library",
          "/activity": "activity",
          "/agents": "agents",
        })[location.pathname] || "tree",
    ),
    [catalog, setCatalog] = useState<Catalog | null>(null),
    [status, setStatus] = useState<Status | null>(null),
    [error, setError] = useState("");
  const [scope, setScopeState] = useState<Scope>("all"),
    [branch, setBranch] = useState<string | null>(null),
    [selected, setSelected] = useState<Skill | null>(null),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [routing, setRouting] = useState(false),
    [railOpen, setRailOpen] = useState(false),
    [route, setRoute] = useState<RouteResult | null>(null),
    [reader, setReader] = useState<Skill | null>(null),
    [toast, setToast] = useState("");
  useEffect(() => {
    if (!railOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) {
        setRailOpen(false);
        document.getElementById("jev-panel-toggle")?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [railOpen]);
  const setPage = (next: string) => {
    setPageState(next);
    const path =
      (
        {
          tree: "/",
          library: "/skills",
          activity: "/activity",
          agents: "/agents",
        } as Record<string, string>
      )[next] || "/";
    if (location.pathname !== path) history.pushState({}, "", path);
  };
  useEffect(() => {
    const back = () =>
      setPageState(
        (
          {
            "/skills": "library",
            "/activity": "activity",
            "/agents": "agents",
          } as Record<string, string>
        )[location.pathname] || "tree",
      );
    addEventListener("popstate", back);
    return () => removeEventListener("popstate", back);
  }, []);
  const selectSequence = useRef(0),
    routeSequence = useRef(0);
  const setScope = (next: Scope) => {
    setScopeState(next);
    routeSequence.current++;
    selectSequence.current++;
    setRouting(false);
    setRoute(null);
    setSelected(null);
  };
  const refresh = () =>
    Promise.all([api<Catalog>("/api/catalog"), api<Status>("/api/status")])
      .then(([c, s]) => {
        setCatalog(c);
        setStatus(s);
        setError("");
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setToast("Copied to clipboard");
    } catch {
      setToast("Clipboard unavailable. Select and copy the text.");
    }
  }
  async function selectSkill(id: string, open = false) {
    const seq = ++selectSequence.current;
    try {
      const skill = await api<Skill>(`/api/skills/${encodeURIComponent(id)}`);
      if (seq !== selectSequence.current) return;
      setSelected(skill);
      if (open) setReader(skill);
      return skill;
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  async function doRoute(value = query) {
    if (value.trim().length < 3) return;
    const seq = ++routeSequence.current;
    setRouting(true);
    setRoute(null);
    try {
      const result = await api<RouteResult>("/api/route", {
        method: "POST",
        body: JSON.stringify({ query: value, scope }),
      });
      if (seq !== routeSequence.current) return;
      setRoute(result);
      if (result.selectedSkill) {
        const skill = await selectSkill(result.selectedSkill);
        if (skill) setBranch(skill.category);
      }
      void api<Status>("/api/status").then(setStatus);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      if (seq === routeSequence.current) setRouting(false);
    }
  }
  // WebMCP uses the exact same actions and data as the visible page.
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool || !catalog) return;
    const lifecycle = new AbortController();
    for (const tool of [
      {
        name: "browse_skill_tree",
        description: "Navigate the visible skill tree to a category.",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: ["all", ...catalog.categories.map((c) => c.id)],
            },
          },
          required: ["category"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: async (input: unknown) => {
          const c = (input as { category?: string })?.category;
          if (
            !c ||
            !["all", ...catalog.categories.map((x) => x.id)].includes(c)
          )
            throw new Error("Unknown category");
          setPage("tree");
          setBranch(c === "all" ? null : c);
          return { category: c };
        },
      },
      {
        name: "open_skill",
        description:
          "Open current skill instructions in the website. Records a view.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input: unknown) => {
          const id = (input as { id?: string })?.id;
          if (!id || !catalog.skills.some((s) => s.id === id))
            throw new Error("Unknown skill");
          const s = await selectSkill(id, true);
          return { id: s?.id, title: s?.title };
        },
      },
    ]) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* Unsupported experimental registration must not break browsing. */
      }
    }
    return () => lifecycle.abort();
  }, [catalog]);

  if (!catalog)
    return (
      <main className="startup">
        <Crosshair size={42} />
        <h1>Skilltree</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button onClick={() => void refresh()}>Try again</button>
          </>
        ) : (
          <p>Opening your library…</p>
        )}
      </main>
    );
  const skills = catalog.skills.filter(
    (s) => scope === "all" || s.scope === scope || s.scope === "both",
  );
  const category = catalog.categories.find((c) => c.id === branch);
  const nav = [
    ["tree", "Skilltree", GitBranch],
    ["library", "All skills", LibraryIcon],
    ["activity", "Activity", ActivityIcon],
    ["agents", "Connect an agent", Plug],
  ] as const;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          aria-label="Skilltree home"
          className="brand"
          onClick={() => {
            setPage("tree");
            setBranch(null);
          }}
        >
          <span className="brand-mark">
            <Crosshair size={24} />
          </span>
          <span>
            Skilltree<span className="brand-period"> /</span>
          </span>
        </button>
        <div className="workspace-label">
          <span className="avatar">{catalog.isExample ? "E" : "P"}</span>
          <span>
            {catalog.isExample ? "Example network" : "Personal network"}
            <small>
              {catalog.isExample
                ? "Fictional skills · Explore freely"
                : "Work + life · Current skills"}
            </small>
          </span>
        </div>
        <nav aria-label="Main navigation">
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              aria-label={label}
              title={label}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => {
                setPage(id);
                if (id === "library") {
                  setBranch(null);
                  setSearch("");
                }
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "library" && <small>{catalog.skills.length}</small>}
              {page === id && id !== "library" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="branch-nav">
          <div className="eyebrow">
            CORE SKILLS <span>06</span>
          </div>
          {catalog.categories.map((c) => {
            const Icon = icons[c.id];
            return (
              <button
                key={c.id}
                className={branch === c.id && page === "tree" ? "chosen" : ""}
                style={colorStyle}
                onClick={() => {
                  setBranch(c.id);
                  setPage("tree");
                }}
              >
                <Icon size={16} />
                <span>{c.name}</span>
                <small>
                  {catalog.skills.filter((s) => s.category === c.id).length}
                </small>
              </button>
            );
          })}
        </div>
        <div className="sidebar-bottom">
          <span className="small-tree">
            <Crosshair size={28} />
          </span>
          <p>
            Your skills.
            <br />
            Ready when you are.
          </p>
          <div>
            <Lock size={12} />
            {catalog.isExample
              ? "Fictional example collection"
              : "Private collection"}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <main className={`workspace page-${page}`}>
          {page === "tree" && (
            <>
              <section className="tree-workspace">
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">
                      {catalog.isExample
                        ? "EXAMPLE LIBRARY"
                        : "CAPABILITY SYSTEM / 01"}
                    </span>
                    <h1>{category ? category.name : "Skilltree"}</h1>
                    <p>
                      {category
                        ? category.verb
                        : "Explore a branch, or let Jev find the right skill."}
                    </p>
                  </div>
                  <div className="collection-counter">
                    <strong>
                      {category
                        ? skills.filter((s) => s.category === category.id)
                            .length
                        : skills.length}
                    </strong>
                    <span>current skills</span>
                  </div>
                </div>
                <div className="canvas-toolbar">
                  <div className="tree-breadcrumb">
                    <button onClick={() => setBranch(null)}>
                      <Crosshair size={15} />
                      All branches
                    </button>
                    {category && (
                      <>
                        <ChevronRight size={13} />
                        <span style={{ color: "var(--accent)" }}>
                          {category.name}
                        </span>
                      </>
                    )}
                  </div>
                  <select
                    className="category-switch"
                    aria-label="Explore a core skill"
                    value={branch || "all"}
                    onChange={(e) =>
                      setBranch(
                        e.target.value === "all" ? null : e.target.value,
                      )
                    }
                  >
                    <option value="all">All core skills</option>
                    {catalog.categories.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    id="jev-panel-toggle"
                    className="route-shortcut"
                    aria-expanded={railOpen}
                    aria-controls="skill-panel"
                    onClick={() => {
                      setRailOpen(!railOpen);
                      if (!railOpen) {
                        requestAnimationFrame(() =>
                          document.getElementById("route-query")?.focus(),
                        );
                      }
                    }}
                  >
                    <Crosshair size={14} />
                    Ask Jev
                  </button>
                  <ScopeSelect scope={scope} onChange={setScope} />
                </div>
                <SkillTree
                  skills={skills}
                  categories={catalog.categories}
                  branch={branch}
                  selected={selected?.id}
                  route={route}
                  onBranch={setBranch}
                  onSelect={(id) => {
                    setRailOpen(true);
                    void selectSkill(id);
                  }}
                />
                <div className="canvas-footer">
                  <span>
                    <span className="tiny-dot" />
                    Current source versions
                  </span>
                  <span>
                    <GitBranch size={13} />
                    Click a core skill to explore its branches
                  </span>
                  <button onClick={() => setPage("library")}>
                    View all skills
                    <ArrowUpRight size={13} />
                  </button>
                </div>
              </section>
              <aside
                id="skill-panel"
                aria-label="Jev navigation and selected skill"
                className={`right-rail ${railOpen ? "open" : ""}`}
              >
                <div className="router-heading">
                  <span className="jev-symbol">
                    <Crosshair size={28} />
                  </span>
                  <div>
                    <h2>Jev navigation</h2>
                    <span>Find the right skill for the task</span>
                  </div>
                  <span className="beta-label">ROUTER</span>
                  <button
                    className="icon-button close-rail"
                    aria-label="Close skill panel"
                    onClick={() => {
                      setRailOpen(false);
                      document.getElementById("jev-panel-toggle")?.focus();
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void doRoute();
                  }}
                >
                  <label htmlFor="route-query">What are you working on?</label>
                  <textarea
                    id="route-query"
                    placeholder="I need to review an article before it goes live…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    maxLength={6000}
                  />
                  <button
                    className="primary route-button"
                    disabled={routing || query.trim().length < 3}
                  >
                    {routing ? (
                      <>
                        <LoaderCircle className="spin" size={16} />
                        Following the branches…
                      </>
                    ) : (
                      <>
                        Find my skill
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
                {!route && !routing && !selected && (
                  <>
                    <span className="try-label">TRY A TASK</span>
                    <div className="examples">
                      {[
                        "Review an article",
                        "Design an iPhone app",
                        "Research a competitor",
                      ].map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            setQuery(t);
                            void doRoute(t);
                          }}
                        >
                          {t}
                          <ArrowUpRight size={12} />
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {route && (
                  <RouteTrace
                    result={route}
                    onSelect={(id) => void selectSkill(id)}
                    skills={skills}
                  />
                )}
                {selected ? (
                  <div className="selected-preview">
                    <div className="rail-section-heading">
                      <span className="eyebrow">SELECTED SKILL</span>
                      <button
                        className="icon-button"
                        aria-label="Deselect skill"
                        onClick={() => setSelected(null)}
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <span className="category-label" style={colorStyle}>
                      {selected.branch}
                    </span>
                    <h2>{selected.title}</h2>
                    <p>{selected.description}</p>
                    <div className="mini-meta">
                      <span>
                        {selected.version
                          ? `v${selected.version}`
                          : "Current revision"}
                      </span>
                      <span>{selected.files.length} files</span>
                      <span>
                        {selected.scope === "both"
                          ? "Work + personal"
                          : selected.scope}
                      </span>
                    </div>
                    <button
                      className="read-button"
                      onClick={() => setReader(selected)}
                    >
                      Read the skill
                      <BookOpen size={16} />
                    </button>
                  </div>
                ) : (
                  !route && (
                    <div className="route-explainer">
                      <div className="eyebrow">
                        A PATH TO THE RIGHT INSTRUCTIONS
                      </div>
                      <div className="explainer-step">
                        <span>01</span>
                        <p>
                          Core skill<small>The kind of work you’re doing</small>
                        </p>
                      </div>
                      <div className="explainer-step">
                        <span>02</span>
                        <p>
                          Branch<small>The discipline it belongs to</small>
                        </p>
                      </div>
                      <div className="explainer-step">
                        <span>03</span>
                        <p>
                          Your skill
                          <small>
                            Current instructions, ready for an agent
                          </small>
                        </p>
                      </div>
                    </div>
                  )
                )}
                <div className="rail-note">
                  <Network size={15} />
                  <p>
                    One library for you and your agents.
                    <button onClick={() => setPage("agents")}>
                      Connect with MCP <ArrowUpRight size={12} />
                    </button>
                  </p>
                </div>
              </aside>
            </>
          )}
          {page === "library" && (
            <section className="full-page">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {catalog.isExample ? "EXAMPLE LIBRARY" : "THE COLLECTION"}
                  </span>
                  <h1>All your skills</h1>
                  <p>
                    Current versions, with their instructions and source files.
                  </p>
                </div>
                <ScopeSelect scope={scope} onChange={setScope} />
              </div>
              <div className="library-controls">
                <div className="search-field">
                  <Search size={18} />
                  <input
                    aria-label="Search skills"
                    placeholder="Search skills, disciplines, or descriptions…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      className="icon-button"
                      aria-label="Clear search"
                      onClick={() => setSearch("")}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                <select
                  aria-label="Filter by branch"
                  value={branch || "all"}
                  onChange={(e) =>
                    setBranch(e.target.value === "all" ? null : e.target.value)
                  }
                >
                  <option value="all">All core skills</option>
                  {catalog.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="skill-table">
                <div className="table-heading">
                  <span>SKILL</span>
                  <span>BRANCH</span>
                  <span>VERSION</span>
                  <span>SCOPE</span>
                  <span />
                </div>
                {skills
                  .filter(
                    (s) =>
                      (!branch || s.category === branch) &&
                      `${s.title} ${s.description} ${s.branch}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  )
                  .map((s) => {
                    const Icon = icons[s.category];
                    return (
                      <button
                        className="skill-row"
                        key={s.id}
                        onClick={() => void selectSkill(s.id, true)}
                      >
                        <span className="skill-row-main">
                          <span className="list-icon" style={colorStyle}>
                            <Icon size={19} />
                          </span>
                          <span>
                            <strong>{s.title}</strong>
                            <small>{s.description}</small>
                          </span>
                        </span>
                        <span>{s.branch}</span>
                        <span className="version-text">
                          {s.version ? `v${s.version}` : s.revision.slice(0, 7)}
                        </span>
                        <span className="scope-text">
                          {s.scope === "both" ? "Work + life" : s.scope}
                        </span>
                        <ArrowUpRight size={17} />
                      </button>
                    );
                  })}
              </div>
              {!skills.some(
                (s) =>
                  (!branch || s.category === branch) &&
                  `${s.title} ${s.description} ${s.branch}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              ) && (
                <div className="empty-state">
                  <Search size={28} />
                  <h2>No skills match this search</h2>
                  <p>Try another phrase or show all branches.</p>
                  <button
                    onClick={() => {
                      setSearch("");
                      setBranch(null);
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
              <div className="library-provenance">
                <ShieldCheck size={18} />
                <p>
                  {catalog.importSummary.duplicates} duplicate copies
                  reconciled. {catalog.importSummary.files} source and
                  supporting files preserved.
                  <small>
                    Imported {date(catalog.importedAt)} · Your source files stay
                    where they are.
                  </small>
                </p>
              </div>
            </section>
          )}
          {page === "activity" && (
            <ActivityPage
              status={status}
              onSelect={(id) => void selectSkill(id, true)}
            />
          )}
          {page === "agents" && <AgentsPage status={status} copy={copy} />}
        </main>
      </div>
      {reader && (
        <SkillReader
          skill={reader}
          categories={catalog.categories}
          onClose={() => setReader(null)}
          copy={copy}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
