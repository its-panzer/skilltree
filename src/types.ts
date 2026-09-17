export type Scope = "all" | "work" | "personal";
export type Skill = {
  id: string;
  name: string;
  title: string;
  description: string;
  version: string | null;
  revision: string;
  category: string;
  branch: string;
  scope: string;
  entryFile?: string;
  sourcePath?: string;
  updatedAt?: string;
  instructions?: string;
  files: { path: string; bytes: number; sha256: string }[];
  warnings?: string[];
  selectionRationale?: string[];
  provenance?: { kind?: string; upstream?: string; evidence?: string };
  duplicates?: unknown[];
  dependencies?: unknown[];
};
export type Category = {
  id: string;
  name: string;
  description: string;
  verb: string;
  color: string;
  icon: string;
};
export type Catalog = {
  skills: Skill[];
  categories: Category[];
  importedAt: string | null;
  isExample: boolean;
  importSummary: {
    skills: number;
    files: number;
    duplicates: number;
    sources: string[];
    notes: string[];
  };
};
export type RouteResult = {
  id: string;
  query: string;
  scope: Scope;
  provider: string;
  status: "matched" | "needs_clarification" | "unavailable";
  selectedSkill: string | null;
  confidence: number | null;
  trace: {
    level: string;
    from: string;
    id: string;
    name: string;
    confidence: number;
    probabilities: Record<string, number>;
  }[];
  alternatives: { id: string; title: string; score: number }[];
  durationMs: number;
  message: string;
};
export type Activity = {
  id: string;
  at: string;
  type: string;
  title: string;
  detail: string;
  actor: string;
  skillId: string | null;
  data: Record<string, unknown>;
};
export type Status = {
  jev: { configured: boolean; model: string };
  mcp: { url: string; authenticated: boolean; remoteConfigured: boolean };
  library: { count: number };
  stats: { total: number; routes: number; handoffs: number };
};
