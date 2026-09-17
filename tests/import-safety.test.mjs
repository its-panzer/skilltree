import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { importLibrary, compareVersions } from "../scripts/import-skills.mjs";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skilltree-import-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, "source");
  fs.mkdirSync(source);
  fs.writeFileSync(
    path.join(source, "SKILL.md"),
    "---\nname: example\nversion: 1.0.0\n---\nOriginal instructions\n",
  );
  const manifest = path.join(root, "sources.json"),
    data = path.join(root, "data");
  const run = (extra = {}) => {
    fs.writeFileSync(
      manifest,
      JSON.stringify({
        skills: [
          {
            id: "example",
            title: "Example",
            root: source,
            category: "content",
            branch: "Writing",
            ...extra,
          },
        ],
      }),
    );
    return importLibrary(manifest, data);
  };
  return { root, source, data, run };
}

test("supplemental files preserve bytes and cannot overwrite a bundle entry", (t) => {
  const f = fixture(t),
    support = path.join(f.root, "helper.txt");
  fs.writeFileSync(support, "support bytes");
  const original = f.run({
    supportFiles: [
      { absolutePath: support, bundlePath: "references/helper.txt" },
    ],
  });
  assert.equal(original.skills[0].files.length, 2);
  assert.equal(
    fs.readFileSync(
      path.join(f.data, "bundles/example/references/helper.txt"),
      "utf8",
    ),
    "support bytes",
  );
  assert.throws(
    () =>
      f.run({
        supportFiles: [{ absolutePath: support, bundlePath: "SKILL.md" }],
      }),
    /Duplicate/,
  );
  assert.throws(
    () =>
      f.run({
        supportFiles: [{ absolutePath: support, bundlePath: "skill.md" }],
      }),
    /Duplicate/,
  );
  assert.equal(
    fs.readFileSync(path.join(f.data, "catalog.json"), "utf8"),
    JSON.stringify(original, null, 2),
  );
  assert.match(
    fs.readFileSync(path.join(f.data, "bundles/example/SKILL.md"), "utf8"),
    /Original instructions/,
  );
});

test("supplemental imports reject environment files, unsafe paths, and oversized files", (t) => {
  const f = fixture(t),
    support = path.join(f.root, "helper.txt"),
    env = path.join(f.root, ".env");
  fs.writeFileSync(support, "example");
  fs.writeFileSync(env, "EXAMPLE=value");
  for (const bundlePath of [
    ".env",
    "nested/.env.local",
    "../escape",
    "/absolute",
    "nested/../SKILL.md",
    "nested\\file",
  ]) {
    assert.throws(
      () => f.run({ supportFiles: [{ absolutePath: support, bundlePath }] }),
      /Unsafe/,
    );
  }
  assert.throws(
    () =>
      f.run({
        supportFiles: [{ absolutePath: env, bundlePath: "renamed.txt" }],
      }),
    /Environment/,
  );
  fs.writeFileSync(support, Buffer.alloc(5_000_001));
  assert.throws(
    () =>
      f.run({
        supportFiles: [{ absolutePath: support, bundlePath: "large.txt" }],
      }),
    /large/,
  );
});

test("stable releases outrank prereleases and versioned candidates outrank unversioned sources", (t) => {
  assert.ok(compareVersions("1.0.0", "1.0.0-rc.1") > 0);
  assert.ok(compareVersions("1.0.0-beta.10", "1.0.0-beta.2") > 0);
  assert.equal(compareVersions("v1.2", "1.2.0+build.7"), 0);
  assert.ok(compareVersions("0.1.0", null) > 0);
  assert.equal(compareVersions(null, "unknown"), 0);
  const f = fixture(t),
    stable = path.join(f.root, "stable");
  fs.mkdirSync(stable);
  fs.writeFileSync(
    path.join(stable, "SKILL.md"),
    "---\nversion: 1.0.0\n---\nStable instructions",
  );
  for (const version of ["version: 1.0.0-beta.1\n", ""]) {
    fs.writeFileSync(
      path.join(f.source, "SKILL.md"),
      `---\nname: example\n${version}---\nCanonical instructions`,
    );
    const catalog = f.run({ candidates: [{ root: stable }] });
    assert.equal(catalog.skills[0].version, "1.0.0");
    assert.match(
      fs.readFileSync(path.join(f.data, "bundles/example/SKILL.md"), "utf8"),
      /Stable instructions/,
    );
  }
});

test("ZIP imports preserve executable files and reject escapes before replacing the live library", (t) => {
  const f = fixture(t),
    archive = path.join(f.root, "example.zip");
  execFileSync("python3", [
    "-c",
    `import zipfile,sys,stat
with zipfile.ZipFile(sys.argv[1], 'w') as z:
 z.writestr('example/SKILL.md', '# Example instructions')
 script=zipfile.ZipInfo('example/run.sh')
 script.create_system=3
 script.external_attr=(stat.S_IFREG | 0o755) << 16
 z.writestr(script, '#!/bin/sh\\nexit 0\\n')`,
    archive,
  ]);
  const catalog = f.run({ root: undefined, archive, archivePrefix: "example" });
  assert.equal(
    fs.statSync(path.join(f.data, "bundles/example/run.sh")).mode & 0o777,
    0o755,
  );
  assert.equal(
    catalog.skills[0].files.find((f) => f.path === "run.sh").mode,
    "755",
  );
  assert.throws(
    () => f.run({ root: undefined, archive, archivePrefix: "../outside" }),
    /Unsafe/,
  );
  execFileSync("python3", [
    "-c",
    "import zipfile,sys\nwith zipfile.ZipFile(sys.argv[1], 'w') as z: z.writestr('../escape', 'unsafe')",
    archive,
  ]);
  assert.throws(() => f.run({ root: undefined, archive }), /Unsafe/);
  assert.equal(
    fs.readFileSync(path.join(f.data, "catalog.json"), "utf8"),
    JSON.stringify(catalog, null, 2),
  );
});
