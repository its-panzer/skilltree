import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
dotenv.config({ path: path.join(root, ".env"), quiet: true });
if (!process.env.TYPESAFE_API_KEY && process.env.TYPESAFE_ENV_FILE) {
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
  port: Number(process.env.PORT || 4783),
  host: process.env.HOST || "127.0.0.1",
  dataDir: path.resolve(
    process.env.SKILL_TREE_DATA_DIR || path.join(root, "data/private"),
  ),
  apiKey: process.env.TYPESAFE_API_KEY || "",
  token: process.env.SKILL_TREE_TOKEN || "",
  model: process.env.JEV_MODEL || "jev-latest",
  publicOrigin: process.env.SKILL_TREE_PUBLIC_ORIGIN || "",
  tailscaleLogin: process.env.TAILSCALE_ALLOWED_LOGIN || "",
};
