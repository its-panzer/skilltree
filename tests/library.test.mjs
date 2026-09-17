import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Library } from "../server/library.mjs";
import { Service } from "../server/service.mjs";
import {
  importLibrary,
  compareVersions,
  frontmatter,
} from "../scripts/import-skills.mjs";
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-tree-test-"));
  return {
    root,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}
test("import selects current semantic version, preserves bytes and all requested support files", () => {
  const f = fixture();
  try {
    for (const v of ["1.1.0", "1.9.0"]) {
      fs.mkdirSync(path.join(f.root, v));
      fs.writeFileSync(
        path.join(f.root, v, "SKILL.md"),
        `---\nname: writer\nversion: ${v}\ndescription: Write a paragraph\n---\nExact source\n`,
      );
      fs.writeFileSync(path.join(f.root, v, "reference.md"), "Reference data", {
        mode: 0o755,
      });
    }
    const manifest = path.join(f.root, "sources.json");
    fs.writeFileSync(
      manifest,
      JSON.stringify({
        skills: [
          {
            id: "writer",
            root: path.join(f.root, "1.1.0"),
            title: "Writer",
            category: "content",
            branch: "Writing",
            candidates: [{ root: path.join(f.root, "1.9.0") }],
          },
        ],
      }),
    );
    const c = importLibrary(manifest, path.join(f.root, "data"));
    assert.equal(c.skills.length, 1);
    assert.equal(c.skills[0].version, "1.9.0");
    assert.equal(c.skills[0].files.length, 2);
    assert.equal(
      fs.statSync(path.join(f.root, "data/bundles/writer/reference.md")).mode &
        0o777,
      0o755,
    );
    assert.equal(
      fs.readFileSync(
        path.join(f.root, "data/bundles/writer/SKILL.md"),
        "utf8",
      ),
      fs.readFileSync(path.join(f.root, "1.9.0/SKILL.md"), "utf8"),
    );
  } finally {
    f.cleanup();
  }
});
test("failed import leaves the live catalog intact", () => {
  const f = fixture();
  try {
    const data = path.join(f.root, "data");
    fs.mkdirSync(data);
    fs.writeFileSync(path.join(data, "catalog.json"), "previous");
    const m = path.join(f.root, "bad.json");
    fs.writeFileSync(
      m,
      JSON.stringify({
        skills: [{ id: "writer", root: "/missing", category: "content" }],
      }),
    );
    assert.throws(() => importLibrary(m, data));
    assert.equal(
      fs.readFileSync(path.join(data, "catalog.json"), "utf8"),
      "previous",
    );
  } finally {
    f.cleanup();
  }
});
test("activity persists across service restarts; invalid reports do not create events", () => {
  const f = fixture();
  try {
    let lib = new Library(f.root);
    const svc = new Service(lib);
    svc.getSkill("clear-writing", "Test agent");
    const count = lib.stats().total;
    assert.throws(() =>
      svc.report({
        skillId: "missing",
        outcome: "completed",
        summary: "Done",
        agent: "test",
      }),
    );
    assert.equal(lib.stats().total, count);
    lib.close();
    lib = new Library(f.root);
    assert.equal(lib.activity()[0].type, "handoff");
    assert.equal(lib.stats().handoffs, 1);
    lib.close();
  } finally {
    f.cleanup();
  }
});
test("bundle file access rejects traversal and symlinks outside the bundle", () => {
  const f = fixture();
  try {
    const bundle = path.join(f.root, "bundles/safe");
    fs.mkdirSync(bundle, { recursive: true });
    fs.writeFileSync(path.join(f.root, "secret"), "private");
    fs.symlinkSync(
      path.join(f.root, "secret"),
      path.join(bundle, "escape.txt"),
    );
    fs.writeFileSync(
      path.join(f.root, "catalog.json"),
      JSON.stringify({
        skills: [
          {
            id: "safe",
            title: "Safe",
            files: [{ path: "escape.txt", bytes: 7 }],
          },
        ],
      }),
    );
    const lib = new Library(f.root);
    assert.throws(() => lib.file("safe", "../secret"));
    assert.throws(() => lib.file("safe", "escape.txt"), /outside/);
    lib.close();
  } finally {
    f.cleanup();
  }
});
test("version comparison is numeric and imperfect frontmatter retains known metadata", () => {
  assert.ok(compareVersions("1.10.0", "1.9.0") > 0);
  const m = frontmatter(
    "---\nname: launch\nversion: 1.0.0\ndescription: Write a post: review it\n---\n# Original",
  );
  assert.equal(m.name, "launch");
  assert.equal(m.description, "Write a post: review it");
  assert.ok(m.metadataWarning);
});

test("preview enforces the actual file size when bundle metadata is stale", () => {
  const f = fixture();
  try {
    const bundle = path.join(f.root, "bundles/example");
    fs.mkdirSync(bundle, { recursive: true });
    fs.writeFileSync(
      path.join(bundle, "large.txt"),
      Buffer.alloc(2_000_001, "x"),
    );
    fs.writeFileSync(
      path.join(f.root, "catalog.json"),
      JSON.stringify({
        skills: [
          {
            id: "example",
            title: "Example",
            files: [{ path: "large.txt", bytes: 1 }],
          },
        ],
      }),
    );
    const lib = new Library(f.root);
    try {
      assert.throws(() => lib.file("example", "large.txt"), { status: 413 });
      assert.doesNotThrow(() => lib.activity({ limit: 2.5 }));
    } finally {
      lib.close();
    }
  } finally {
    f.cleanup();
  }
});
