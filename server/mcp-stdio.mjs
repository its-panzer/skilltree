import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Library } from "./library.mjs";
import { Service } from "./service.mjs";
import { createMcpServer } from "./mcp.mjs";
const library = new Library();
const server = createMcpServer(new Service(library));
await server.connect(new StdioServerTransport());
library.record({
  type: "connection",
  title: "An MCP client connected",
  detail: "Local stdio transport",
  actor: "MCP",
});
process.on("SIGTERM", async () => {
  await server.close();
  library.close();
  process.exit(0);
});
