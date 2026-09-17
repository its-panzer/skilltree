import { z } from "zod";
import { routeQuery } from "./jev.mjs";
import { config } from "./config.mjs";
export const routeSchema = z.object({
  query: z.string().trim().min(3).max(6000),
  scope: z.enum(["all", "work", "personal"]).default("all"),
});
export const reportSchema = z.object({
  skillId: z.string().max(100),
  outcome: z.enum(["started", "completed", "failed"]),
  summary: z.string().trim().min(1).max(1500),
  agent: z.string().trim().min(1).max(100),
});
export class Service {
  constructor(library) {
    this.library = library;
  }
  async route(input, actor = "website") {
    const { query, scope } = routeSchema.parse(input);
    const result = await routeQuery(query, this.library.skills(), { scope });
    this.library.record({
      type: "route",
      title: result.selectedSkill
        ? `Routed to ${this.library.get(result.selectedSkill).title}`
        : result.status === "unavailable"
          ? "Routing unavailable"
          : "A little more context needed",
      detail: query,
      actor,
      skillId: result.selectedSkill,
      data: result,
    });
    return result;
  }
  getSkill(id, actor = "website") {
    const skill = this.library.get(id);
    this.library.record({
      type: actor === "website" ? "view" : "handoff",
      title:
        actor === "website"
          ? `Opened ${skill.title}`
          : `Instructions handed to ${actor}`,
      detail: skill.title,
      actor,
      skillId: id,
      data: { version: skill.version, revision: skill.revision },
    });
    return skill;
  }
  report(input) {
    const { skillId, outcome, summary, agent } = reportSchema.parse(input);
    const skill = this.library.get(skillId);
    return this.library.record({
      type: "agent_report",
      title: `${agent} reported: ${outcome}`,
      detail: summary,
      actor: agent,
      skillId,
      data: {
        outcome,
        skill: skill.title,
        verification: "self-reported by connected agent",
      },
    });
  }
  status() {
    return {
      jev: {
        configured: Boolean(config.apiKey),
        model: config.model,
        threshold: 0.65,
      },
      mcp: {
        transports: ["stdio", "streamable-http"],
        url: config.publicOrigin
          ? `${config.publicOrigin}/mcp`
          : `http://127.0.0.1:${config.port}/mcp`,
        authenticated: Boolean(config.token),
        remoteConfigured: Boolean(config.publicOrigin),
      },
      library: {
        count: this.library.catalog.skills.length,
        importedAt: this.library.catalog.importedAt,
        isExample: this.library.isExample,
      },
      stats: this.library.stats(),
    };
  }
}
