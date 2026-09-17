import { useCallback, useEffect, useRef, useState } from "react";
import {
  GitBranch,
  Activity as ActivityIcon,
  Plug,
  ArrowUpRight,
  ChevronRight,
  Feather,
  Lock,
  BookOpen,
  RotateCcw,
  Layers,
  Network,
  Terminal,
} from "lucide-react";
import type { Status, Activity } from "../types";
import { date } from "../lib/display";
import { api } from "../lib/api";

export function ActivityPage({
  status,
  onSelect,
}: {
  status: Status | null;
  onSelect: (s: string) => void;
}) {
  const [events, setEvents] = useState<Activity[]>([]),
    [filter, setFilter] = useState("all"),
    [error, setError] = useState(""),
    [selectedEvent, setSelectedEvent] = useState<Activity | null>(null),
    [liveStatus, setLiveStatus] = useState(status);
  const pending = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    try {
      const [events, status] = await Promise.all([
        api<Activity[]>(
          `/api/activity?limit=200${filter === "all" ? "" : `&type=${filter}`}`,
          { signal: controller.signal },
        ),
        api<Status>("/api/status", { signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      setEvents(events);
      setLiveStatus(status);
      setError("");
    } catch (error) {
      if (!controller.signal.aborted) setError((error as Error).message);
    }
  }, [filter]);
  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 6000);
    return () => {
      clearInterval(interval);
      pending.current?.abort();
    };
  }, [refresh]);
  const eventIcons: Record<string, typeof Feather> = {
    route: GitBranch,
    view: BookOpen,
    handoff: Plug,
    import: Layers,
    agent_report: Terminal,
    connection: Network,
  };
  return (
    <section className="full-page activity-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE TRAIL</span>
          <h1>Activity</h1>
          <p>See which skills were found, opened, and handed to agents.</p>
        </div>
        <button className="secondary" onClick={() => void refresh()}>
          <RotateCcw size={15} />
          Refresh
        </button>
      </div>
      <div className="activity-summary">
        <span>
          <GitBranch size={19} />
          <strong>{liveStatus?.stats.routes || 0}</strong>routing decisions
        </span>
        <span>
          <Plug size={19} />
          <strong>{liveStatus?.stats.handoffs || 0}</strong>agent handoffs
        </span>
        <span className="live-note">
          <span className="tiny-dot" />
          Updates every 6 seconds
        </span>
      </div>
      <div className="activity-tabs">
        {[
          ["all", "Everything"],
          ["route", "Routing"],
          ["handoff", "Handoffs"],
          ["agent_report", "Agent reports"],
          ["view", "Skill views"],
        ].map(([v, label]) => (
          <button
            className={filter === v ? "active" : ""}
            key={v}
            onClick={() => setFilter(v)}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      {events.length === 0 ? (
        <div className="empty-state">
          <ActivityIcon size={30} />
          <h2>No activity here yet</h2>
          <p>Route a task or let a connected agent retrieve a skill.</p>
        </div>
      ) : (
        <div className="timeline">
          {events.map((e) => {
            const Icon = eventIcons[e.type] || ActivityIcon;
            return (
              <article className="timeline-item" key={e.id}>
                <span className={`event-icon ${e.type}`}>
                  <Icon size={18} />
                </span>
                <div className="event-body">
                  <button
                    className="event-title"
                    onClick={() =>
                      setSelectedEvent(selectedEvent?.id === e.id ? null : e)
                    }
                  >
                    {e.title}
                    <ChevronRight size={14} />
                  </button>
                  <p>{e.detail}</p>
                  <div className="event-meta">
                    <span>{e.actor}</span>
                    <span>{e.type.replace("_", " ")}</span>
                    {e.skillId && (
                      <button onClick={() => onSelect(e.skillId!)}>
                        Open skill
                        <ArrowUpRight size={11} />
                      </button>
                    )}
                  </div>
                  {selectedEvent?.id === e.id && (
                    <pre className="event-json">
                      {JSON.stringify(e.data, null, 2)}
                    </pre>
                  )}
                </div>
                <time dateTime={e.at}>
                  {new Date(e.at).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  <small>{date(e.at)}</small>
                </time>
              </article>
            );
          })}
        </div>
      )}
      <p className="footnote">
        <Lock size={12} />
        Activity is stored in your private library. Agent outcomes are labeled
        as reports.
      </p>
    </section>
  );
}
