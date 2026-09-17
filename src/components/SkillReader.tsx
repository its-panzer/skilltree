import { useEffect, useRef, useState } from "react";
import {
  GitBranch,
  ChevronRight,
  Check,
  Copy,
  X,
  BookOpen,
  FileText,
  Folder,
  AlertCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Skill, Category } from "../types";
import { icons, colorStyle, stripFrontmatter } from "../lib/display";
import { api } from "../lib/api";

export function SkillReader({
  skill,
  categories,
  onClose,
  copy,
}: {
  skill: Skill;
  categories: Category[];
  onClose: () => void;
  copy: (s: string) => void;
}) {
  const [tab, setTab] = useState("instructions"),
    [file, setFile] = useState<{
      path: string;
      content: string;
      encoding: string;
    } | null>(null),
    [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const category = categories.find((c) => c.id === skill.category)!;
  const Icon = icons[skill.category];
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  const linkedFile = (href?: string) => {
    if (!href || /^(https?:|mailto:|#)/.test(href)) return undefined;
    const clean = href.split("#")[0].replace(/^(\.\.\/|\.\/)+/, "");
    const exact = skill.files.find((f) => f.path === clean);
    if (exact) return exact.path;
    const matches = skill.files.filter((f) => f.path.endsWith("/" + clean));
    return matches.length === 1 ? matches[0].path : undefined;
  };
  async function openFile(p: string) {
    setError("");
    try {
      setFile(
        await api(`/api/skills/${skill.id}/file?path=${encodeURIComponent(p)}`),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <dialog
      className="skill-dialog"
      ref={dialog}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className="reader-shell">
        <header className="reader-header">
          <div className="reader-category" style={colorStyle}>
            <Icon size={19} />
            {category.name}
            <ChevronRight size={13} />
            {skill.branch}
          </div>
          <button
            className="icon-button"
            aria-label="Close skill"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </header>
        <div className="reader-heading">
          <span className="eyebrow">CURRENT SKILL</span>
          <h1>{skill.title}</h1>
          <p>{skill.description}</p>
          <div className="reader-metadata">
            <span>
              <Check size={12} />
              {skill.version
                ? `Version ${skill.version}`
                : `Revision ${skill.revision}`}
            </span>
            <span>
              {skill.scope === "both" ? "Work + personal" : skill.scope}
            </span>
            <span>{skill.files.length} files</span>
          </div>
        </div>
        <div className="reader-tabs">
          <div>
            {["instructions", "files", "source"].map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t === "instructions" ? (
                  <BookOpen size={15} />
                ) : t === "files" ? (
                  <Folder size={15} />
                ) : (
                  <GitBranch size={15} />
                )}
                <span>{t}</span>
              </button>
            ))}
          </div>
          <button
            className="copy-instructions"
            onClick={() => copy(skill.instructions || "")}
          >
            <Copy size={14} />
            Copy instructions
          </button>
        </div>
        <div className="reader-content">
          {skill.warnings?.map((w) => (
            <p className="source-warning" key={w}>
              <AlertCircle size={16} />
              {w}
            </p>
          ))}
          {tab === "instructions" && (
            <div className="markdown">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => {
                    const path = linkedFile(href);
                    return path ? (
                      <button
                        className="inline-file-link"
                        onClick={() => {
                          setTab("files");
                          void openFile(path);
                        }}
                      >
                        {children}
                      </button>
                    ) : (
                      <a
                        href={href}
                        target={href?.startsWith("http") ? "_blank" : undefined}
                        rel="noreferrer"
                      >
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {stripFrontmatter(skill.instructions || "")}
              </ReactMarkdown>
            </div>
          )}
          {tab === "files" && (
            <div className="file-browser">
              <div className="file-list">
                {skill.files.map((f) => (
                  <button
                    className={file?.path === f.path ? "active" : ""}
                    onClick={() => void openFile(f.path)}
                    key={f.path}
                  >
                    <FileText size={14} />
                    <span>{f.path}</span>
                    <small>{Math.ceil(f.bytes / 1024)} KB</small>
                  </button>
                ))}
              </div>
              {error && <p role="alert">{error}</p>}
              {file && (
                <div className="file-preview">
                  <div>
                    <strong>{file.path}</strong>
                    <button onClick={() => copy(file.content)}>
                      <Copy size={13} />
                      Copy
                    </button>
                  </div>
                  {file.encoding === "base64" ? (
                    <p>Binary file · available as base64 through MCP.</p>
                  ) : (
                    <pre>{file.content}</pre>
                  )}
                </div>
              )}
            </div>
          )}
          {tab === "source" && (
            <div className="source-details">
              <h2>Source & version</h2>
              <dl>
                <dt>Original source</dt>
                <dd>
                  <code>{skill.sourcePath || "Example library"}</code>
                </dd>
                <dt>Content revision</dt>
                <dd>{skill.revision}</dd>
                <dt>Source modified</dt>
                <dd>
                  {skill.updatedAt
                    ? new Date(skill.updatedAt).toLocaleString()
                    : "Example"}
                </dd>
                <dt>Authorship</dt>
                <dd>
                  {skill.provenance?.kind?.replaceAll("-", " ") || "Example"}
                  {skill.provenance?.upstream && (
                    <p>Based on {skill.provenance.upstream}</p>
                  )}
                </dd>
              </dl>
              <h3>Why this version</h3>
              {skill.selectionRationale?.map((r, i) => (
                <p key={i}>{r}</p>
              ))}
              <p>
                {skill.duplicates?.length || 0} alternate copies recorded in the
                import manifest.
              </p>
              {Boolean(skill.dependencies?.length) && (
                <>
                  <h3>Execution dependencies</h3>
                  <p>
                    This skill uses tools or context beyond its instructions.
                    Check these before running it on another machine.
                  </p>
                  <pre>{JSON.stringify(skill.dependencies, null, 2)}</pre>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
