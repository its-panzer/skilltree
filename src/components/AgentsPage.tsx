import { useEffect, useState } from "react";
import { Crosshair, Lock, Check, Copy, Globe, Terminal } from "lucide-react";
import type { Status } from "../types";
import { api } from "../lib/api";

export function AgentsPage({
  status,
  copy,
}: {
  status: Status | null;
  copy: (s: string) => void;
}) {
  const [connection, setConnection] = useState<{
      local: unknown;
      remote: unknown;
      tokenFile: string;
    } | null>(null),
    [mode, setMode] = useState("local"),
    [error, setError] = useState("");
  useEffect(() => {
    void api<{ local: unknown; remote: unknown; tokenFile: string }>(
      "/api/connection",
    )
      .then(setConnection)
      .catch((error: Error) => setError(error.message));
  }, []);
  const tools = [
    ["route_query", "Let Jev choose a path through the tree."],
    ["get_skill_tree", "Explore the full capability map."],
    ["list_skills", "Find skills by scope or text."],
    ["get_skill", "Retrieve current instructions and their source."],
    ["get_skill_file", "Read supporting references and scripts."],
    ["get_activity", "Read decisions, handoffs, and reports."],
    ["report_skill_activity", "Record what your agent did with a skill."],
  ];
  return (
    <section className="full-page agents-page">
      {error && <p role="alert">{error}</p>}
      <div className="page-heading">
        <div>
          <span className="eyebrow">BUILT FOR YOUR AGENTS</span>
          <h1>Same skills. Wherever you work.</h1>
          <p>Connect an MCP client to your private Skilltree.</p>
        </div>
        <span className="connection-badge">
          <span className="tiny-dot" />
          MCP ready
        </span>
      </div>
      <div className="agent-layout">
        <div>
          <div className="agent-diagram">
            <span>
              <Terminal size={29} />
              <small>Your agent</small>
            </span>
            <div className="diagram-line">
              <span>MCP</span>
            </div>
            <span className="diagram-tree">
              <Crosshair size={34} />
              <small>Skilltree</small>
            </span>
            <div className="diagram-line">
              <span>DECISION</span>
            </div>
            <span>
              <span className="diagram-jev">✳</span>
              <small>Jev</small>
            </span>
          </div>
          <h2>Connect your client</h2>
          <p className="muted">
            Use local access on this Mac, or HTTPS from a device on your
            Tailscale network.
          </p>
          <div className="connection-tabs">
            <button
              className={mode === "local" ? "active" : ""}
              onClick={() => setMode("local")}
            >
              <Terminal size={15} />
              On this Mac
            </button>
            <button
              className={mode === "remote" ? "active" : ""}
              onClick={() => setMode("remote")}
            >
              <Globe size={15} />
              Through Tailscale
            </button>
          </div>
          <div className="code-block">
            <div>
              <span>
                {mode === "local"
                  ? "MCP · standard input/output"
                  : "MCP · Streamable HTTP"}
              </span>
              <button
                onClick={() =>
                  copy(
                    JSON.stringify(
                      mode === "local" ? connection?.local : connection?.remote,
                      null,
                      2,
                    ),
                  )
                }
              >
                <Copy size={14} />
                Copy config
              </button>
            </div>
            <pre>
              {JSON.stringify(
                mode === "local" ? connection?.local : connection?.remote,
                null,
                2,
              ) || "Loading configuration…"}
            </pre>
          </div>
          {mode === "remote" && (
            <div className="connection-note">
              <Lock size={17} />
              <p>
                The remote endpoint requires your bearer token. Use the
                SKILL_TREE_TOKEN value from your server’s .env file in your MCP
                client configuration. Both devices must be connected to your
                Tailscale network.
              </p>
            </div>
          )}
          <div className="agent-howto">
            <h3>A typical request</h3>
            <p>
              “Use Skilltree to find the right skill for reviewing this article.
              Read its instructions, do the review, and record the result.”
            </p>
            <small>
              Jev chooses the skill. Your connected agent does the work.
            </small>
          </div>
        </div>
        <aside className="agent-tools">
          <div className="eyebrow">
            AVAILABLE TOOLS <span>07</span>
          </div>
          {tools.map(([name, desc]) => (
            <div className="tool-item" key={name}>
              <code>{name}</code>
              <p>{desc}</p>
            </div>
          ))}
          <div className="agent-status">
            <span>
              <Check size={14} />
              Exact source instructions
            </span>
            <span>
              <Check size={14} />
              Version + provenance
            </span>
            <span>
              <Check size={14} />
              Persistent activity
            </span>
          </div>
          <p className="footnote">
            {status?.mcp.remoteConfigured
              ? "Private HTTPS address configured."
              : "Remote address not configured yet."}
          </p>
        </aside>
      </div>
    </section>
  );
}
