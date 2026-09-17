import type { CSSProperties } from "react";
import {
  Feather,
  Code2,
  ShieldCheck,
  Compass,
  Workflow,
  Sun,
} from "lucide-react";
export const icons: Record<string, typeof Feather> = {
  content: Feather,
  build: Code2,
  review: ShieldCheck,
  research: Compass,
  operate: Workflow,
  life: Sun,
};
// The tactical palette uses one accent for interactions; icons distinguish categories.
export const colorStyle = { "--branch": "var(--accent)" } as CSSProperties;
export const date = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "Example";
export const stripFrontmatter = (s: string) =>
  s.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
