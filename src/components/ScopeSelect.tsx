import { Layers } from "lucide-react";
import type { Scope } from "../types";

export function ScopeSelect({
  scope,
  onChange,
}: {
  scope: Scope;
  onChange: (s: Scope) => void;
}) {
  return (
    <label className="scope-select">
      <Layers size={14} />
      <select
        aria-label="Filter skill scope"
        value={scope}
        onChange={(e) => onChange(e.target.value as Scope)}
      >
        <option value="all">Work + personal</option>
        <option value="work">Work skills</option>
        <option value="personal">Personal skills</option>
      </select>
    </label>
  );
}
