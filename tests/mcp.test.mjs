import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Library } from "../server/library.mjs";
import { Service } from "../server/service.mjs";
import { createMcpServer } from "../server/mcp.mjs";
import { access, tokenMatches } from "../server/auth.mjs";
test("real MCP handshake, tool discovery, skill retrieval, resources and agent reporting", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-tree-mcp-"));
  const lib = new Library(dir);
  const server = createMcpServer(new Service(lib));
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(a), client.connect(b)]);
    const { tools } = await client.listTools();
    assert.equal(tools.length, 7);
    const result = await client.callTool({
      name: "get_skill",
      arguments: { id: "clear-writing" },
    });
    const s = JSON.parse(result.content[0].text);
    assert.match(s.instructions, /Read the draft/);
    assert.equal(lib.activity()[0].type, "handoff");
    const { resources } = await client.listResources();
    assert.ok(resources.some((r) => r.uri === "skill-tree://catalog"));
    const resource = await client.readResource({
      uri: "skill-tree://skills/clear-writing",
    });
    assert.match(resource.contents[0].text, /Clear writing/);
    assert.equal(lib.stats().handoffs, 2);
    assert.equal(lib.activity()[0].actor, "MCP agent");
    await client.callTool({
      name: "report_skill_activity",
      arguments: {
        skillId: "clear-writing",
        agent: "test",
        outcome: "completed",
        summary: "Example draft reviewed",
      },
    });
    assert.equal(
      lib.activity()[0].data.verification,
      "self-reported by connected agent",
    );
    const bad = await client.callTool({
      name: "get_skill",
      arguments: { id: "unknown" },
    });
    assert.equal(bad.isError, true);
  } finally {
    await client.close();
    await server.close();
    lib.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("HTTP trust requires approved Host and Origin; remote MCP still needs a bearer token", () => {
  const c = {
    port: 4783,
    token: "test-token",
    publicOrigin: "https://machine.example:8443",
    tailscaleLogin: "owner@example.com",
  };
  const req = (headers, remoteAddress = "127.0.0.1") => ({
    headers,
    socket: { remoteAddress },
  });
  assert.equal(access(req({ host: "evil.example" }), c).allowed, false);
  assert.equal(
    access(req({ host: "127.0.0.1:4783", origin: "https://evil.example" }), c)
      .allowed,
    false,
  );
  assert.equal(access(req({ host: "127.0.0.1:4783" }), c).local, true);
  assert.equal(
    access(
      req({
        host: "machine.example:8443",
        "tailscale-user-login": "stranger@example.com",
      }),
      c,
    ).tailnet,
    false,
  );
  assert.equal(
    access(
      req({
        host: "machine.example:8443",
        "tailscale-user-login": "owner@example.com",
      }),
      c,
    ).tailnet,
    true,
  );
  assert.equal(
    access(
      req({ host: "machine.example:8443", authorization: "Bearer test-token" }),
      c,
    ).authenticated,
    true,
  );
  assert.equal(
    access(
      req({ host: "machine.example:8443", authorization: "test-token" }),
      c,
    ).authenticated,
    false,
  );
  assert.equal(tokenMatches("wrong", "test-token"), false);
  assert.equal(tokenMatches("", ""), false);
});
