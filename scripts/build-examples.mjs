import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { parse } from "yaml";
import { categories } from "../server/taxonomy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function buildExamples() {
  const skills = fs
    .readdirSync(path.join(root, "examples/skills"))
    .sort()
    .map((id) => {
      const sourcePath = `examples/skills/${id}/SKILL.md`;
      const bytes = fs.readFileSync(path.join(root, sourcePath));
      const match = bytes
        .toString("utf8")
        .match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      if (!match) throw new Error(`Missing example frontmatter: ${id}`);
      const { name, description, metadata, license } = parse(match[1]);
      if (
        name !== id ||
        !description ||
        license !== "MIT" ||
        !categories.some((c) => c.id === metadata?.category) ||
        !["work", "personal", "both"].includes(metadata?.scope) ||
        !metadata?.title ||
        !metadata?.branch ||
        !metadata?.version
      ) {
        throw new Error(`Invalid example metadata: ${id}`);
      }
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      return {
        id,
        name,
        title: metadata.title,
        description,
        category: metadata.category,
        branch: metadata.branch,
        scope: metadata.scope,
        version: metadata.version,
        revision: sha256.slice(0, 12),
        sha256,
        entryFile: "SKILL.md",
        sourcePath,
        sourceType: "example",
        files: [{ path: "SKILL.md", bytes: bytes.length, sha256, mode: "644" }],
        provenance: {
          kind: "fictional-example",
          evidence: "Original example written for Skilltree; MIT licensed.",
        },
        selectionRationale: [
          "Bundled framework example. Import your own library to replace it.",
        ],
      };
    });
  return {
    schemaVersion: 1,
    importedAt: null,
    importSummary: {
      skills: skills.length,
      files: skills.length,
      duplicates: 0,
      sources: ["Original fictional examples"],
      notes: [
        "These examples demonstrate the framework and contain no personal collection content.",
      ],
    },
    skills,
  };
}
if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  fs.writeFileSync(
    path.join(root, "examples/catalog.json"),
    JSON.stringify(buildExamples(), null, 2) + "\n",
  );
  console.log("Rebuilt the fictional example catalog from SKILL.md sources.");
}
