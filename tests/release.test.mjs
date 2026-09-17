import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { checkPublic } from "../scripts/check-public.mjs";

function repository(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "skilltree-release-test-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd, stdio: "pipe" });
  git("init", "--quiet");
  git("config", "user.name", "Example contributor");
  git("config", "user.email", "contributor@example.com");
  const commit = () => {
    git("add", ".");
    git("commit", "--quiet", "-m", "Fixture");
  };
  return { cwd, commit };
}

test("release checks include removed secrets in earlier commits", (t) => {
  const { cwd, commit } = repository(t);
  fs.writeFileSync(
    path.join(cwd, "README.md"),
    "Example " + "sk_" + "a".repeat(32),
  );
  commit();
  fs.writeFileSync(path.join(cwd, "README.md"), "Fictional example");
  commit();
  assert.equal(checkPublic({ cwd, history: false }).failures.length, 0);
  const result = checkPublic({ cwd });
  assert.equal(result.commits, 2);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /possible API key/);
});

test("release checks reject private runtime paths and allow the env template", (t) => {
  const { cwd, commit } = repository(t);
  fs.mkdirSync(path.join(cwd, "data/private"), { recursive: true });
  fs.writeFileSync(path.join(cwd, "data/private/catalog.json"), "{}");
  fs.writeFileSync(path.join(cwd, ".env.example"), "EXAMPLE_KEY=\n");
  commit();
  const result = checkPublic({ cwd });
  assert.equal(result.failures.length, 2);
  assert.ok(
    result.failures.every((message) =>
      message.includes("data/private/catalog.json"),
    ),
  );
});

test("release checks accept a clean framework commit", (t) => {
  const { cwd, commit } = repository(t);
  fs.writeFileSync(
    path.join(cwd, "README.md"),
    "A fictional skill library example.",
  );
  commit();
  assert.deepEqual(checkPublic({ cwd }).failures, []);
});
