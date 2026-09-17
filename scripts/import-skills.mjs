import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { valid, compare } from "semver";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { parse } from "yaml";
import { config } from "../server/config.mjs";
import { categories } from "../server/taxonomy.mjs";

export const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!m) return {};
  try {
    const metadata = parse(m[1]) || {};
    return {
      ...metadata,
      version: metadata.version ?? metadata.metadata?.version,
    };
  } catch {
    // Preserve instructions byte-for-byte even when source frontmatter contains an unquoted colon.
    const result = {
      metadataWarning:
        "Source frontmatter is not valid YAML. Name, description, and version were recovered without changing the source.",
    };
    for (const key of ["name", "description", "version"]) {
      const match = m[1].match(
        new RegExp(`^${key}:\\s*([^\\n]*(?:\\n[ \\t]+[^\\n]*)*)`, "m"),
      );
      if (match)
        result[key] = match[1]
          .replace(/^[>|]-?\s*/, "")
          .trim()
          .replace(/^['"]|['"]$/g, "")
          .replace(/\s*\n\s*/g, " ");
    }
    return result;
  }
}
export function compareVersions(a, b) {
  const version = (value) => {
    const text = String(value || "").trim();
    return valid(/^v?\d+\.\d+$/.test(text) ? `${text}.0` : text);
  };
  const x = version(a),
    y = version(b);
  // Versioned sources outrank unversioned sources; canonical breaks equal-version ties.
  return x && y ? compare(x, y) : Number(Boolean(x)) - Number(Boolean(y));
}
function bundlePath(relative) {
  if (
    typeof relative !== "string" ||
    !relative ||
    relative.includes("\\") ||
    path.isAbsolute(relative) ||
    relative
      .split("/")
      .some((part) => !part || part === "." || part === "..") ||
    /(^|\/)\.env($|\.)/.test(relative)
  ) {
    throw new Error("Unsafe bundle path");
  }
  return relative;
}
function copyFile(origin, relative, bundle, files, sourcePath) {
  bundlePath(relative);
  const destinationKey = (value) => value.normalize("NFC").toLowerCase();
  if (
    files.some((file) => destinationKey(file.path) === destinationKey(relative))
  )
    throw new Error("Duplicate bundle destination");
  if (/^\.env($|\.)/.test(path.basename(origin)))
    throw new Error("Environment files cannot be imported");
  const stat = fs.statSync(origin);
  if (!stat.isFile() || stat.size > 5_000_000)
    throw new Error("Review large or nonregular file before importing");
  const bytes = fs.readFileSync(origin),
    mode = stat.mode & 0o777;
  if (bytes.length > 5_000_000)
    throw new Error("Review large file before importing");
  const dest = path.join(bundle, relative);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    fs.writeFileSync(dest, bytes, { mode, flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error("Duplicate bundle destination");
    throw error;
  }
  fs.chmodSync(dest, mode);
  files.push({
    path: relative,
    bytes: bytes.length,
    sha256: hash(bytes),
    mode: mode.toString(8),
    ...(sourcePath ? { sourcePath } : {}),
  });
}
function walk(dir, prefix = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (
      [
        ".git",
        "node_modules",
        ".venv",
        "__pycache__",
        "dist",
        "build",
        ".DS_Store",
      ].includes(e.name) ||
      e.name === ".env" ||
      e.name.startsWith(".env.")
    )
      return [];
    const relative = path.posix.join(prefix, e.name);
    if (e.isSymbolicLink()) return [];
    return e.isDirectory()
      ? walk(path.join(dir, e.name), relative)
      : [relative];
  });
}
function fromArchive(entry) {
  if (entry.archivePrefix) bundlePath(entry.archivePrefix.replace(/\/$/, ""));
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "skill-tree-import-"));
  try {
    execFileSync(
      "python3",
      [
        fileURLToPath(new URL("./extract-archive.py", import.meta.url)),
        entry.archive,
        temp,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    return { root: path.join(temp, entry.archivePrefix || ""), temp };
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true });
    throw error;
  }
}
export function importLibrary(manifestPath, dataDir = config.dataDir) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest.skills))
    throw new Error("Manifest must contain a skills array");
  const ids = new Set();
  for (const s of manifest.skills) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(s.id) || ids.has(s.id))
      throw new Error(`Invalid or duplicate skill id: ${s.id}`);
    ids.add(s.id);
  }
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const staging = fs.mkdtempSync(path.join(dataDir, ".import-"));
  const skills = [];
  const extractedDirectories = [];
  try {
    for (const source of manifest.skills) {
      if (!categories.some((c) => c.id === source.category))
        throw new Error(`Invalid category for ${source.id}`);
      let selected = { ...source };
      let extracted;
      const candidates = [
        {
          root: source.root,
          entryFile: source.entryFile || "SKILL.md",
          canonical: true,
        },
        ...(source.candidates || []),
      ]
        .filter(
          (c) =>
            c.root &&
            fs.existsSync(path.join(c.root, c.entryFile || "SKILL.md")),
        )
        .map((c) => ({
          ...c,
          meta: frontmatter(
            fs.readFileSync(
              path.join(c.root, c.entryFile || "SKILL.md"),
              "utf8",
            ),
          ),
        }));
      candidates.sort(
        (a, b) =>
          compareVersions(b.meta.version, a.meta.version) ||
          Number(b.canonical) - Number(a.canonical),
      );
      if (candidates.length) selected = { ...source, ...candidates[0] };
      else if (source.archive) {
        extracted = fromArchive(source);
        extractedDirectories.push(extracted.temp);
        selected.root = extracted.root;
      }
      if (!selected.root || !fs.existsSync(selected.root))
        throw new Error(`Missing source for ${source.id}`);
      const entryFile = bundlePath(selected.entryFile || "SKILL.md");
      const raw = fs.readFileSync(path.join(selected.root, entryFile));
      const meta = frontmatter(raw.toString("utf8"));
      const fileList = source.includeFiles || walk(selected.root);
      const files = [];
      const bundle = path.join(staging, source.id);
      for (const relative of fileList) {
        bundlePath(relative);
        const origin = fs.realpathSync(path.join(selected.root, relative));
        if (!origin.startsWith(fs.realpathSync(selected.root) + path.sep))
          throw new Error("Bundle escapes its source");
        copyFile(origin, relative, bundle, files);
      }
      for (const support of source.supportFiles || []) {
        copyFile(
          fs.realpathSync(support.absolutePath),
          support.bundlePath,
          bundle,
          files,
          support.absolutePath,
        );
      }
      if (!files.some((f) => f.path === entryFile))
        throw new Error(`Entrypoint is not included: ${source.id}`);
      skills.push({
        id: source.id,
        name: meta.name || source.id,
        title: source.title,
        description: String(meta.description || source.description || ""),
        routingNotes: source.routingNotes || null,
        version: meta.version ? String(meta.version) : null,
        revision: hash(raw).slice(0, 12),
        sha256: hash(raw),
        category: source.category,
        branch: source.branch,
        scope: source.scope || "personal",
        entryFile,
        sourcePath: source.archive || path.join(selected.root, entryFile),
        sourceType: source.archive ? "archive" : "directory",
        updatedAt: fs
          .statSync(path.join(selected.root, entryFile))
          .mtime.toISOString(),
        files,
        provenance: source.provenance || {},
        duplicates: source.duplicates || [],
        selectionRationale: source.selectionRationale || [
          "Canonical source selected; declared semantic versions take precedence over duplicate installs.",
        ],
        warnings: [
          ...(source.warnings || []),
          ...(meta.metadataWarning ? [meta.metadataWarning] : []),
        ],
        dependencies: source.dependencies || [],
        pathAliases: source.pathAliases || {},
      });
      if (extracted)
        fs.rmSync(extracted.temp, { recursive: true, force: true });
    }
    const catalog = {
      schemaVersion: 1,
      importedAt: new Date().toISOString(),
      skills: skills.sort((a, b) => a.title.localeCompare(b.title)),
      importSummary: {
        skills: skills.length,
        files: skills.reduce((n, s) => n + s.files.length, 0),
        duplicates: skills.reduce((n, s) => n + s.duplicates.length, 0),
        sources: manifest.sources || [],
        excluded: manifest.excluded || [],
        notes: manifest.notes || [],
      },
    };
    // Validate every bundle before replacing the live snapshot; keep a rollback directory until the catalog swap succeeds.
    const bundles = path.join(dataDir, "bundles"),
      backup = path.join(dataDir, ".bundles-previous");
    fs.rmSync(backup, { recursive: true, force: true });
    if (fs.existsSync(bundles)) fs.renameSync(bundles, backup);
    try {
      fs.renameSync(staging, bundles);
      fs.writeFileSync(
        path.join(dataDir, "catalog.next.json"),
        JSON.stringify(catalog, null, 2),
      );
      fs.renameSync(
        path.join(dataDir, "catalog.next.json"),
        path.join(dataDir, "catalog.json"),
      );
    } catch (error) {
      fs.rmSync(bundles, { recursive: true, force: true });
      if (fs.existsSync(backup)) fs.renameSync(backup, bundles);
      throw error;
    }
    fs.rmSync(backup, { recursive: true, force: true });
    return catalog;
  } finally {
    for (const directory of extractedDirectories)
      fs.rmSync(directory, { recursive: true, force: true });
    if (fs.existsSync(staging))
      fs.rmSync(staging, { recursive: true, force: true });
  }
}
if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  const catalog = importLibrary(
    process.argv[2] || path.join(config.dataDir, "sources.json"),
  );
  console.log(
    `Imported ${catalog.skills.length} current skills and ${catalog.importSummary.files} files. Restart Skilltree to load the new snapshot.`,
  );
}
