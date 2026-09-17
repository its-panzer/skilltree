import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "skilltree-demo-"));
const child = spawn(process.execPath, [path.join(root, "server/index.mjs")], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    SKILL_TREE_DEMO: "1",
    SKILL_TREE_DATA_DIR: dataDir,
    PORT: process.env.PORT || "4784",
  },
});
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  child.kill("SIGTERM");
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("close", (code) => {
  fs.rmSync(dataDir, { recursive: true, force: true });
  process.exitCode = stopping ? 0 : code || 0;
});
console.log(
  "Example mode: fictional skills, temporary activity, no credentials. Jev routing needs a key in a normal local setup.",
);
