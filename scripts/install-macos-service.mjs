import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { config } from "../server/config.mjs";
if (process.platform !== "darwin")
  throw new Error("This installer is for macOS");
if (!fs.existsSync(path.join(config.root, "dist/index.html")))
  throw new Error("Run npm run build first");
const label = "local.skill-tree.server";
const plist = path.join(os.homedir(), "Library/LaunchAgents", label + ".plist");
const escape = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
fs.mkdirSync(path.dirname(plist), { recursive: true });
fs.mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array><string>${escape(process.execPath)}</string><string>${escape(path.join(config.root, "server/index.mjs"))}</string></array><key>WorkingDirectory</key><string>${escape(config.root)}</string><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>10</integer><key>StandardOutPath</key><string>${escape(path.join(config.dataDir, "server.log"))}</string><key>StandardErrorPath</key><string>${escape(path.join(config.dataDir, "server-error.log"))}</string></dict></plist>\n`;
try {
  execFileSync("launchctl", ["bootout", `gui/${process.getuid()}`, plist], {
    stdio: "ignore",
  });
} catch {
  /* First install has no previous job. */
}
fs.writeFileSync(plist, xml, { mode: 0o600 });
execFileSync("plutil", ["-lint", plist], { stdio: "ignore" });
execFileSync("launchctl", ["bootstrap", `gui/${process.getuid()}`, plist]);
fs.writeFileSync(
  path.join(config.dataDir, "service.json"),
  JSON.stringify({ label, plist }, null, 2),
);
console.log(
  "Skilltree installed as a user LaunchAgent. Starts at sign-in and restarts after failures.",
);
