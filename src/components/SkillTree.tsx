import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ChevronRight,
  Crosshair,
  Plus,
  Minus,
  Maximize2,
  Network,
} from "lucide-react";
import type { Skill, Category, RouteResult } from "../types";
import { icons } from "../lib/display";

export function SkillTree({
  skills,
  categories,
  branch,
  selected,
  route,
  onBranch,
  onSelect,
}: {
  skills: Skill[];
  categories: Category[];
  branch: string | null;
  selected?: string;
  route: RouteResult | null;
  onBranch: (b: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setZoom(1);
    const el = scroller.current;
    if (!el) return;
    const center = () => {
      el.scrollLeft = branch
        ? 0
        : Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
    };
    el.scrollTop = 0;
    center();
    const observer = new ResizeObserver(center);
    observer.observe(el);
    return () => observer.disconnect();
  }, [branch]);
  const active = categories.find((c) => c.id === branch);
  const scoped = skills.filter((s) => !branch || s.category === branch);
  const branches = active ? [...new Set(scoped.map((s) => s.branch))] : [];
  const columns = active ? Math.max(1, branches.length) : 6;
  const width = active ? Math.max(960, columns * 300) : 960;
  const height = active
    ? Math.max(
        700,
        360 +
          Math.max(
            ...branches.map((b) => scoped.filter((s) => s.branch === b).length),
            0,
          ) *
            72,
      )
    : 700;
  const groups = active
    ? branches.map((b, i) => ({
        id: b,
        name: b,
        x: (width * (i + 0.5)) / columns,
        y: 225,
        skills: scoped.filter((s) => s.branch === b),
        count: scoped.filter((s) => s.branch === b).length,
        category: active.id,
        side: 0,
        leafX: (width * (i + 0.5)) / columns,
      }))
    : categories.map((c, i) => ({
        id: c.id,
        name: c.name,
        x: i < 3 ? 300 : 660,
        y: 135 + (i % 3) * 210,
        skills: featuredSkills(scoped.filter((s) => s.category === c.id)),
        count: scoped.filter((s) => s.category === c.id).length,
        category: c.id,
        side: i < 3 ? -1 : 1,
        leafX: i < 3 ? 108 : 852,
      }));
  const selectedSkill = skills.find((s) => s.id === selected);
  const routeCategory = route?.trace.find((t) => t.level === "category")?.id;
  const highlightedCategory = selectedSkill?.category || routeCategory;
  const rootY = active ? 88 : 345;
  const leafY = (g: (typeof groups)[number], i: number) =>
    active ? 360 + i * 72 : g.y - 50 + i * 50;
  const point = (x: number, y: number) => ({
    left: `${(x / width) * 100}%`,
    top: `${(y / height) * 100}%`,
  });
  return (
    <div className={`tree-canvas ${active ? "branch-view" : "network-view"}`}>
      <div className="canvas-grain" />
      <div className="canvas-annotation">
        <Crosshair size={13} />
        {active ? "SPECIALIZATION MAP" : "NETWORK OVERVIEW"}
      </div>
      <span className="mobile-map-hint">Swipe to explore</span>
      <div className="canvas-coordinate" aria-hidden="true">
        ST / {active ? active.id.toUpperCase() : "ROOT"}
      </div>
      <div
        className="canvas-scroll"
        ref={scroller}
        tabIndex={0}
        aria-label="Skilltree map. Scroll to explore the network."
      >
        <div
          className="tree-drawing"
          style={
            {
              width: `${Math.max(100, zoom * 100)}%`,
              minWidth:
                zoom > 1
                  ? width * zoom
                  : active && columns > 3
                    ? width
                    : undefined,
              height: height * zoom,
              "--zoom": zoom,
            } as CSSProperties
          }
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="connections"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <pattern
                id="map-grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 H 0 V 40"
                  fill="none"
                  stroke="#b4c1c7"
                  strokeOpacity=".035"
                />
                <path
                  d="M 19 20 H 23 M 21 18 V 22"
                  fill="none"
                  stroke="#b4c1c7"
                  strokeOpacity=".12"
                />
              </pattern>
            </defs>
            <rect width={width} height={height} fill="url(#map-grid)" />
            {!active && (
              <g className="map-orbits" fill="none" stroke="#83949f">
                <circle cx="480" cy={rootY} r="112" strokeDasharray="2 8" />
                <circle cx="480" cy={rootY} r="150" strokeDasharray="100 460" />
              </g>
            )}
            {groups.map((g) => {
              const highlight =
                highlightedCategory === g.category &&
                (!active || selectedSkill?.branch === g.id);
              const trunk = active
                ? `M ${width / 2} ${rootY + 48} V 172 H ${g.x} V ${g.y - 38}`
                : `M ${480 + g.side * 53} ${rootY} H ${480 + g.side * 88} V ${g.y + (g.y < rootY ? 20 : g.y > rootY ? -20 : 0)} L ${480 + g.side * 108} ${g.y} H ${g.x - g.side * 39}`;
              return (
                <g key={g.id} fill="none" className="branch-connections">
                  <path className={highlight ? "route-edge" : ""} d={trunk} />
                  {g.skills
                    .map((s, i) => ({ s, i }))
                    .sort(
                      (a, b) =>
                        Number(a.s.id === selected) -
                        Number(b.s.id === selected),
                    )
                    .map(({ s, i }) => (
                      <path
                        key={s.id}
                        className={selected === s.id ? "selected-edge" : ""}
                        d={
                          active
                            ? `M ${g.x - 38} ${g.y} H ${g.x - 140} V ${leafY(g, i)} H ${g.x - 112}`
                            : `M ${g.x + g.side * 39} ${g.y} H ${g.x + g.side * 70} V ${leafY(g, i)} H ${g.leafX - g.side * 78}`
                        }
                      />
                    ))}
                </g>
              );
            })}
          </svg>
          {active && scoped.length === 0 && (
            <div className="map-empty">
              No skills in this scope. Choose another scope above.
            </div>
          )}
          <button
            className="root-node"
            style={point(width / 2, rootY)}
            onClick={() => onBranch(null)}
            aria-label="Show all branches"
          >
            <span className="root-ring">
              {active ? (
                (() => {
                  const Icon = icons[active.id];
                  return <Icon size={36} />;
                })()
              ) : (
                <Network size={38} />
              )}
            </span>
            <strong>{active ? active.name : "Skilltree"}</strong>
            <small>{scoped.length} CURRENT SKILLS</small>
          </button>
          {groups.map((g, index) => {
            const Icon = icons[g.category];
            const onRoute =
              highlightedCategory === g.category &&
              (!active || selectedSkill?.branch === g.id);
            return (
              <div key={g.id}>
                <button
                  className={`core-node ${onRoute ? "on-route" : ""}`}
                  style={point(g.x, g.y)}
                  aria-label={`${g.name}, ${g.count} ${g.count === 1 ? "skill" : "skills"}`}
                  onClick={() =>
                    active
                      ? scroller.current?.scrollTo({
                          top: 280,
                          behavior: window.matchMedia(
                            "(prefers-reduced-motion: reduce)",
                          ).matches
                            ? "instant"
                            : "smooth",
                        })
                      : onBranch(g.id)
                  }
                >
                  <span className="core-number" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="core-medallion">
                    <Icon size={28} />
                  </span>
                  <strong>{g.name}</strong>
                  <small>
                    {g.count} {g.count === 1 ? "skill" : "skills"}{" "}
                    <ChevronRight size={11} />
                  </small>
                </button>
                {g.skills.map((s, i) => (
                  <button
                    key={s.id}
                    title={s.description}
                    className={`leaf-node ${selected === s.id ? "selected" : ""}`}
                    style={point(g.leafX, leafY(g, i))}
                    onClick={() => onSelect(s.id)}
                    aria-pressed={selected === s.id}
                  >
                    <span className="leaf-gem">
                      <Icon size={13} />
                    </span>
                    <span>{s.title}</span>
                    {selected === s.id && (
                      <span className="selected-indicator" />
                    )}
                  </button>
                ))}
                {!active &&
                  scoped.filter((s) => s.category === g.category).length >
                    3 && (
                    <button
                      className="more-skills"
                      style={point(g.leafX, g.y + 86)}
                      onClick={() => onBranch(g.id)}
                    >
                      +
                      {scoped.filter((s) => s.category === g.category).length -
                        3}{" "}
                      more skills
                      <ChevronRight size={11} />
                    </button>
                  )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="canvas-legend">
        <span className="legend-core" />
        {active ? "Discipline" : "Core skill"}
        <span className="legend-leaf" />
        Specialized skill
      </div>
      <div className="zoom-controls">
        <button
          aria-label="Zoom out"
          disabled={zoom <= 1}
          onClick={() => setZoom((z) => Math.max(1, z - 0.2))}
        >
          <Minus size={15} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          aria-label="Zoom in"
          disabled={zoom >= 1.8}
          onClick={() => setZoom((z) => Math.min(1.8, z + 0.2))}
        >
          <Plus size={15} />
        </button>
        <span className="zoom-divider" />
        <button
          aria-label="Fit tree"
          onClick={() => {
            setZoom(1);
            if (scroller.current) {
              scroller.current.scrollTop = 0;
              scroller.current.scrollLeft = branch
                ? 0
                : Math.max(
                    0,
                    (scroller.current.scrollWidth -
                      scroller.current.clientWidth) /
                      2,
                  );
            }
          }}
        >
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
  );
}

// Represent distinct branches first, then fill the remaining overview slots.
function featuredSkills(skills: Skill[], limit = 3): Skill[] {
  const sorted = [...skills].sort(
    (a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  );
  const branches = new Set<string>();
  const representatives = sorted.filter((skill) => {
    if (branches.has(skill.branch)) return false;
    branches.add(skill.branch);
    return true;
  });
  return [
    ...representatives,
    ...sorted.filter((skill) => !representatives.includes(skill)),
  ].slice(0, limit);
}
