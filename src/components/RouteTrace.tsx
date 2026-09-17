import { ArrowUpRight, AlertCircle } from "lucide-react";
import type { Skill, RouteResult } from "../types";

export function RouteTrace({
  result,
  onSelect,
  skills,
}: {
  result: RouteResult;
  onSelect: (id: string) => void;
  skills: Skill[];
}) {
  return (
    <div className="route-result" aria-live="polite">
      <div className="rail-section-heading">
        <span className="eyebrow">
          {result.status === "matched" ? "PATH FOUND" : "ROUTING RESULT"}
        </span>
        <small>
          {result.provider === "jev" ? "Jev" : "Local"} ·{" "}
          {(result.durationMs / 1000).toFixed(1)}s
        </small>
      </div>
      {result.trace.map((step, i) => (
        <div className="trace-step" key={step.level}>
          <span className="trace-index">{i + 1}</span>
          <div>
            <small>{step.level}</small>
            <strong>{step.name}</strong>
          </div>
          <span className="confidence">
            {Math.round(step.confidence * 100)}%
          </span>
        </div>
      ))}
      {result.status !== "matched" && (
        <>
          <p className="route-message">
            <AlertCircle size={16} />
            {result.message}
          </p>
          {result.alternatives.length > 0 && (
            <>
              <span className="try-label">LOCAL MATCHES</span>
              {result.alternatives
                .slice(0, 3)
                .filter((s) => skills.some((x) => x.id === s.id))
                .map((s) => (
                  <button
                    className="alternative"
                    key={s.id}
                    onClick={() => onSelect(s.id)}
                  >
                    {s.title}
                    <ArrowUpRight size={13} />
                  </button>
                ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
