import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const demo = process.env.SKILL_TREE_DEMO === "1";
if (!demo) dotenv.config({ path: path.join(root, ".env"), quiet: true });
if (!demo && !process.env.TYPESAFE_API_KEY && process.env.TYPESAFE_ENV_FILE) {
  try {
    process.env.TYPESAFE_API_KEY =
      dotenv.parse(fs.readFileSync(process.env.TYPESAFE_ENV_FILE))
        .TYPESAFE_API_KEY || "";
  } catch {
    /* Status exposes configuration failure without secrets. */
  }
}
export const config = {
  root,
  demo,
  port: Number(process.env.PORT || 4783),
  host: demo ? "127.0.0.1" : process.env.HOST || "127.0.0.1",
  dataDir: path.resolve(
    process.env.SKILL_TREE_DATA_DIR || path.join(root, "data/private"),
  ),
  apiKey: demo ? "" : process.env.TYPESAFE_API_KEY || "",
  token: demo ? "" : process.env.SKILL_TREE_TOKEN || "",
  model: process.env.JEV_MODEL || "jev-latest",
  publicOrigin: demo ? "" : process.env.SKILL_TREE_PUBLIC_ORIGIN || "",
  tailscaleLogin: demo ? "" : process.env.TAILSCALE_ALLOWED_LOGIN || "",
};
