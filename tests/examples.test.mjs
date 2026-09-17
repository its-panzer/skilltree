import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { buildExamples } from "../scripts/build-examples.mjs";
import { Library } from "../server/library.mjs";
import { categories } from "../server/taxonomy.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
test("example catalog stays in sync with all six branches and retrievable source files", (t) => {
  const expected = buildExamples();
  assert.deepEqual(
    JSON.parse(
      fs.readFileSync(path.join(root, "examples/catalog.json"), "utf8"),
    ),
    expected,
  );
  for (const category of categories)
    assert.equal(
      expected.skills.filter((s) => s.category === category.id).length,
      4,
    );
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skilltree-examples-"));
  const library = new Library(dir);
  t.after(() => {
    library.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  assert.equal(library.isExample, true);
  assert.ok(library.skills({ scope: "work" }).length > 0);
  assert.ok(library.skills({ scope: "personal" }).length > 0);
  for (const skill of expected.skills) {
    const source = library.file(skill.id, "SKILL.md");
    assert.equal(library.get(skill.id).instructions, source.content);
    assert.equal(
      createHash("sha256").update(source.content).digest("hex"),
      skill.sha256,
    );
    assert.match(
      source.content,
      /Fictional example for the Skilltree framework/,
    );
    assert.throws(() => library.file(skill.id, "../catalog.json"));
  }
});

test("demo mode ignores inherited credentials and a private catalog", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skilltree-demo-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const privateCatalog = JSON.stringify({
    skills: [{ id: "private-sentinel" }],
  });
  fs.writeFileSync(path.join(dir, "catalog.json"), privateCatalog);
  const privateLibrary = new Library(dir);
  privateLibrary.record({
    type: "route",
    title: "Synthetic private task",
    detail: "private activity sentinel",
  });
  privateLibrary.close();
  const databaseBefore = fs.readFileSync(path.join(dir, "activity.sqlite"));
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import assert from 'node:assert/strict';
    import {config} from './server/config.mjs';
    import {Library} from './server/library.mjs';
    import {createApp} from './server/index.mjs';
    import {once} from 'node:events';
    assert.equal(config.apiKey, '');
    assert.equal(config.token, '');
    assert.equal(config.publicOrigin, '');
    assert.equal(config.tailscaleLogin, '');
    assert.equal(config.host, '127.0.0.1');
    const library = new Library();
    assert.equal(library.isExample, true);
    assert.equal(library.skills().length, 24);
    assert.ok(!library.skills().some(s => s.id === 'private-sentinel'));
    assert.ok(library.activity().every(event => event.detail !== 'private activity sentinel'));
    const {app} = await createApp({library});
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const connection = await (await fetch('http://127.0.0.1:' + server.address().port + '/api/connection')).json();
    assert.equal(connection.local.mcpServers['skill-tree'].env.SKILL_TREE_DEMO, '1');
    await new Promise(resolve => server.close(resolve));
    library.close();
  `,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        SKILL_TREE_DEMO: "1",
        SKILL_TREE_DATA_DIR: dir,
        TYPESAFE_API_KEY: "test-inherited-key",
        SKILL_TREE_TOKEN: "test-inherited-token",
        SKILL_TREE_PUBLIC_ORIGIN: "https://example.invalid",
        TAILSCALE_ALLOWED_LOGIN: "example@example.com",
        HOST: "0.0.0.0",
      },
    },
  );
  assert.deepEqual(
    fs.readFileSync(path.join(dir, "activity.sqlite")),
    databaseBefore,
  );
  assert.equal(
    fs.readFileSync(path.join(dir, "catalog.json"), "utf8"),
    privateCatalog,
  );
});
