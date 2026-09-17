import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { config } from "./config.mjs";
import { categories, treeFor } from "./taxonomy.mjs";

export class Library {
  constructor(dataDir = config.dataDir) {
    this.dataDir = dataDir;
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.catalogPath = path.join(dataDir, "catalog.json");
    const example = path.join(config.root, "examples/catalog.json");
    this.isExample = config.demo || !fs.existsSync(this.catalogPath);
    this.catalog = JSON.parse(
      fs.readFileSync(this.isExample ? example : this.catalogPath, "utf8"),
    );
    this.db = new DatabaseSync(
      config.demo ? ":memory:" : path.join(dataDir, "activity.sqlite"),
    );
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS activity (id TEXT PRIMARY KEY, at TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL, actor TEXT NOT NULL, skill_id TEXT, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS activity_at ON activity(at DESC);`);
    if (!this.db.prepare("SELECT id FROM activity LIMIT 1").get())
      this.record({
        type: "import",
        title: `${this.catalog.skills.length} skills added to the tree`,
        detail: this.isExample
          ? "Example library. Import your own skill bundles to replace it."
          : "Current source versions collected with their supporting files.",
        actor: "library",
        data: {
          count: this.catalog.skills.length,
          importedAt: this.catalog.importedAt,
        },
      });
  }
  skills({ query = "", scope = "all", category } = {}) {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    return this.catalog.skills.filter(
      (s) =>
        (scope === "all" || s.scope === scope || s.scope === "both") &&
        (!category || s.category === category) &&
        tokens.every((t) =>
          `${s.title} ${s.name} ${s.description} ${s.branch} ${s.category}`
            .toLowerCase()
            .includes(t),
        ),
    );
  }
  summary() {
    return {
      ...this.catalog,
      skills: this.catalog.skills.map(({ instructions, ...s }) => s),
      categories,
      tree: treeFor(this.catalog.skills),
      isExample: this.isExample,
    };
  }
  get(id) {
    const skill = this.catalog.skills.find((s) => s.id === id);
    if (!skill)
      throw Object.assign(new Error("Skill not found"), { status: 404 });
    return {
      ...skill,
      instructions: this.file(id, skill.entryFile || "SKILL.md").content,
    };
  }
  file(id, filePath) {
    const skill = this.catalog.skills.find((s) => s.id === id);
    if (!skill)
      throw Object.assign(new Error("Skill not found"), { status: 404 });
    const entry = skill.files?.find((f) => f.path === filePath);
    if (!entry || filePath.includes("..") || path.isAbsolute(filePath))
      throw Object.assign(new Error("File not found in this skill bundle"), {
        status: 404,
      });
    const bundle = this.isExample
      ? path.join(config.root, "examples/skills", id)
      : path.join(this.dataDir, "bundles", id);
    const resolved = fs.realpathSync(path.join(bundle, filePath));
    if (!resolved.startsWith(fs.realpathSync(bundle) + path.sep))
      throw Object.assign(new Error("File is outside this skill bundle"), {
        status: 403,
      });
    if (fs.statSync(resolved).size > 2_000_000)
      throw Object.assign(new Error("File is too large to preview"), {
        status: 413,
      });
    const bytes = fs.readFileSync(resolved);
    const binary = bytes.subarray(0, 8192).includes(0);
    return {
      path: filePath,
      content: bytes.toString(binary ? "base64" : "utf8"),
      encoding: binary ? "base64" : "utf8",
      sha256: entry.sha256,
      bytes: bytes.length,
      mode: entry.mode,
    };
  }
  record({
    type,
    title,
    detail = "",
    actor = "website",
    skillId = null,
    data = {},
  }) {
    const event = {
      id: randomUUID(),
      at: new Date().toISOString(),
      type,
      title,
      detail,
      actor,
      skillId,
      data,
    };
    this.db
      .prepare("INSERT INTO activity VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(
        event.id,
        event.at,
        type,
        title,
        detail,
        actor,
        skillId,
        JSON.stringify(data),
      );
    return event;
  }
  activity({ type, limit = 100, before } = {}) {
    const rows = this.db
      .prepare(
        "SELECT * FROM activity WHERE (? IS NULL OR type = ?) AND (? IS NULL OR at < ?) ORDER BY at DESC, rowid DESC LIMIT ?",
      )
      .all(
        type || null,
        type || null,
        before || null,
        before || null,
        Math.min(Math.max(Math.floor(Number(limit)) || 100, 1), 200),
      );
    return rows.map(({ skill_id, data, ...r }) => ({
      ...r,
      skillId: skill_id,
      data: JSON.parse(data),
    }));
  }
  stats() {
    return {
      total: this.db.prepare("SELECT count(*) AS n FROM activity").get().n,
      routes: this.db
        .prepare("SELECT count(*) AS n FROM activity WHERE type = 'route'")
        .get().n,
      handoffs: this.db
        .prepare("SELECT count(*) AS n FROM activity WHERE type = 'handoff'")
        .get().n,
    };
  }
  close() {
    this.db.close();
  }
}
