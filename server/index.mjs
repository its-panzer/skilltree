import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { config } from "./config.mjs";
import { Library } from "./library.mjs";
import { Service } from "./service.mjs";
import { createMcpServer } from "./mcp.mjs";
import { access } from "./auth.mjs";

export async function createApp({ library = new Library(), dev = false } = {}) {
  const service = new Service(library),
    app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    if (!dev)
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
      );
    req.access = access(req, config);
    if (!req.access.allowed)
      return res.status(403).json({ error: req.access.reason });
    next();
  });
  app.use(express.json({ limit: "64kb" }));
  app.get("/health", (_req, res) =>
    res.json({ ok: true, service: "skill-tree" }),
  );
  app.use((req, res, next) => {
    if (req.path === "/mcp") return next();
    if (!(req.access.local || req.access.tailnet || req.access.authenticated))
      return res.status(401).json({
        error:
          "Connect through your authorized Tailscale account, or provide a bearer token.",
      });
    if (
      req.path.startsWith("/data/") ||
      req.path.startsWith("/.git/") ||
      req.path.startsWith("/.env")
    )
      return res.status(404).json({ error: "Not found" });
    next();
  });
  app.all("/mcp", async (req, res) => {
    if (!req.access.authenticated) {
      res.setHeader("WWW-Authenticate", 'Bearer realm="Skilltree"');
      return res.status(401).json({ error: "An MCP bearer token is required" });
    }
    if (req.method !== "POST")
      return res
        .status(405)
        .set("Allow", "POST")
        .json({ error: "Stateless MCP accepts POST requests" });
    const server = createMcpServer(service);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    if (req.body?.method === "initialize")
      library.record({
        type: "connection",
        title: "An MCP client connected",
        detail: "Authenticated Streamable HTTP transport",
        actor: "MCP",
      });
    await transport.handleRequest(req, res, req.body);
  });
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (!(req.access.local || req.access.tailnet || req.access.authenticated))
      return res.status(401).json({
        error:
          "Connect through your authorized Tailscale account, or provide a bearer token.",
      });
    next();
  });
  app.get("/api/catalog", (_req, res) => res.json(library.summary()));
  app.get("/api/status", (_req, res) => res.json(service.status()));
  app.get("/api/activity", (req, res) => res.json(library.activity(req.query)));
  app.get("/api/skills/:id", (req, res) =>
    res.json(service.getSkill(req.params.id)),
  );
  app.get("/api/skills/:id/file", (req, res) =>
    res.json(library.file(req.params.id, String(req.query.path || ""))),
  );
  const routes = new Map();
  app.post("/api/route", async (req, res) => {
    const key = req.socket.remoteAddress,
      now = Date.now();
    const times = (routes.get(key) || []).filter((t) => now - t < 60_000);
    if (times.length >= 30)
      return res
        .status(429)
        .json({ error: "Routing is busy. Try again in a minute." });
    times.push(now);
    routes.set(key, times);
    res.json(await service.route(req.body));
  });
  app.post("/api/activity/report", (req, res) =>
    res.status(201).json(service.report(req.body)),
  );
  app.get("/api/connection", (_req, res) =>
    res.json({
      local: {
        mcpServers: {
          "skill-tree": {
            command: process.execPath,
            args: [path.join(config.root, "server/mcp-stdio.mjs")],
          },
        },
      },
      remote: {
        mcpServers: {
          "skill-tree": {
            type: "http",
            url: service.status().mcp.url,
            headers: { Authorization: "Bearer ${SKILL_TREE_TOKEN}" },
          },
        },
      },
      tokenFile: path.join(config.dataDir, "connection.json"),
    }),
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Unknown API endpoint" }),
  );
  if (dev) {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: {
        middlewareMode: true,
        fs: {
          deny: [
            ".env",
            ".env.*",
            "*.{crt,pem}",
            "**/.git/**",
            "**/data/**",
            `${config.dataDir.replaceAll(path.sep, "/")}/**`,
          ],
        },
        watch: { ignored: ["**/data/**", `${config.dataDir}/**`] },
      },
      appType: "custom",
    });
    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      if (req.method !== "GET") return next();
      try {
        const template = await fs.readFile(
          path.join(config.root, "index.html"),
          "utf8",
        );
        res
          .type("html")
          .send(await vite.transformIndexHtml(req.originalUrl, template));
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
    app.locals.vite = vite;
  } else {
    app.use(express.static(path.join(config.root, "dist"), { index: false }));
    app.use((req, res, next) =>
      req.method === "GET"
        ? res.sendFile(path.join(config.root, "dist/index.html"))
        : next(),
    );
  }
  app.use((err, _req, res, _next) => {
    const status = err.name === "ZodError" ? 400 : err.status || 500;
    res.status(status).json({
      error:
        err.name === "ZodError"
          ? "Invalid request. Check the required fields."
          : status === 500
            ? "The request could not be completed."
            : err.message,
    });
    if (status === 500) console.error(err.message);
  });
  return { app, service, library };
}
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  if (config.host !== "127.0.0.1" && !config.token)
    throw new Error(
      "A bearer token is required before binding to a network interface",
    );
  const { app, library } = await createApp({
    dev: process.argv.includes("--dev"),
  });
  const http = app.listen(config.port, config.host, () =>
    console.log(`Skilltree: http://${config.host}:${config.port}`),
  );
  process.on("SIGTERM", () =>
    http.close(async () => {
      await app.locals.vite?.close();
      library.close();
      process.exit(0);
    }),
  );
}
