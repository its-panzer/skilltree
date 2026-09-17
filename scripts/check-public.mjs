import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const patterns = [
  [/\/Users\/[^/\s]+\//, "personal absolute path"],
  [/\/home\/[^/\s]+\//, "personal absolute path"],
  [/(?:sk|ts)_[A-Za-z0-9_-]{30,}/, "possible API key"],
  [/Bearer [a-f0-9]{64}/i, "literal bearer token"],
  [/(?:[a-z0-9-]+\.)+ts\.net\b/i, "private tailnet hostname"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key"],
];

function inspect(file, bytes, label) {
  if (
    /(^|\/)(?:data|artifacts|node_modules|dist)\//.test(file) ||
    (/(^|\/)\.env($|\.)/.test(file) && file !== ".env.example") ||
    /\.(?:sqlite|db)(?:-|$)/.test(file) ||
    /\.(?:key|pem|p12|pfx)$/.test(file)
  )
    return [`${label}: runtime data or credential file`];
  if (bytes.length > 5_000_000)
    return [`${label}: large file requires manual review`];
  if (bytes.subarray(0, 8192).includes(0))
    return [`${label}: binary file requires manual review`];
  const text = bytes.toString("utf8");
  return patterns
    .filter(([pattern]) => pattern.test(text))
    .map(([, reason]) => `${label}: ${reason}`);
}

export function checkPublic({
  cwd = process.cwd(),
  ref = "HEAD",
  history = true,
  worktree = true,
} = {}) {
  const git = (args) =>
    execFileSync("git", args, {
      cwd,
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  const failures = [],
    seen = new Set();
  let files = 0,
    commits = 0;
  if (worktree) {
    const paths = git(["ls-files", "-z"])
      .toString()
      .split("\0")
      .filter(Boolean);
    for (const file of paths) {
      const absolute = path.join(cwd, file);
      // Deleted tracked files are absent from the next release; history still gets checked below.
      if (!fs.existsSync(absolute)) continue;
      if (fs.lstatSync(absolute).isSymbolicLink())
        failures.push(`${file}: tracked symlink requires manual review`);
      else failures.push(...inspect(file, fs.readFileSync(absolute), file));
      files++;
    }
    if (!files) failures.push("No tracked files to inspect");
  }
  if (history) {
    const revisions = git(["rev-list", ref, "--"])
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean);
    commits = revisions.length;
    for (const revision of revisions) {
      const entries = git(["ls-tree", "-rz", "--full-tree", revision])
        .toString()
        .split("\0")
        .filter(Boolean);
      for (const entry of entries) {
        const [meta, ...name] = entry.split("\t"),
          [mode, type, oid] = meta.split(" "),
          file = name.join("\t");
        const identity = `${oid}:${file}`;
        if (seen.has(identity)) continue;
        seen.add(identity);
        const label = `${revision.slice(0, 8)}:${file}`;
        if (type !== "blob" || mode === "120000")
          failures.push(
            `${label}: linked repository or symlink requires manual review`,
          );
        else
          failures.push(
            ...inspect(file, git(["cat-file", "blob", oid]), label),
          );
      }
    }
  }
  return { files, commits, blobs: seen.size, failures };
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--worktree-only"))
    throw new Error("Usage: check-public.mjs [--worktree-only]");
  const result = checkPublic({ history: !args.includes("--worktree-only") });
  if (result.failures.length) {
    console.error(result.failures.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(
      `Checked ${result.files} tracked files and ${result.blobs} historical file versions across ${result.commits} commits. No configured privacy patterns found. Review imported-content exposure separately before publishing.`,
    );
  }
}
