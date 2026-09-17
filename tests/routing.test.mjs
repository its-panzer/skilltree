import test from "node:test";
import assert from "node:assert/strict";
import { routeQuery, askJev, rankLocally } from "../server/jev.mjs";
const skills = [
  {
    id: "edit",
    title: "Edit an article",
    category: "review",
    branch: "Editorial",
    scope: "work",
    description: "Review articles before publication",
    name: "edit",
  },
  {
    id: "repair",
    title: "Repair a backup",
    category: "life",
    branch: "Maintenance",
    scope: "personal",
    description: "Repair a stale backup",
    name: "repair",
  },
];
const answer = (choice, confidence = 0.95) => ({
  type: "choice",
  choice,
  confidence,
  probabilities: { [choice]: confidence, __none__: 1 - confidence },
  inputTokens: 20,
});
test("Jev traverses category, branch, and skill without executing it", async () => {
  const calls = [];
  const decisions = ["review", "Editorial", "edit"];
  const r = await routeQuery("Review an article", skills, {
    apiKey: "test",
    judge: async (q, choices) => {
      calls.push(choices.map((c) => c.id));
      return answer(decisions.shift());
    },
  });
  assert.equal(r.status, "matched");
  assert.equal(r.selectedSkill, "edit");
  assert.deepEqual(calls, [["review", "life"], ["Editorial"], ["edit"]]);
  assert.equal(r.inputTokens, 60);
  assert.equal(r.confidence, 0.95);
});
test("scope excludes personal-only skills before any remote decision", async () => {
  const r = await routeQuery("Review", skills, {
    apiKey: "test",
    scope: "work",
    judge: async (q, choices) => {
      assert.ok(!choices.some((c) => c.id === "life" || c.id === "repair"));
      return answer("__none__", 0.98);
    },
  });
  assert.equal(r.selectedSkill, null);
  assert.equal(r.status, "needs_clarification");
});
test("low confidence stops traversal and never hands off instructions", async () => {
  let calls = 0;
  const r = await routeQuery("Do something", skills, {
    apiKey: "test",
    judge: async () => {
      calls++;
      return answer("review", 0.4);
    },
  });
  assert.equal(calls, 1);
  assert.equal(r.status, "needs_clarification");
  assert.equal(r.selectedSkill, null);
});
test("missing credentials do not masquerade as Jev or produce calibrated confidence", async () => {
  const r = await routeQuery("Repair backup", skills, { apiKey: "" });
  assert.equal(r.provider, "local");
  assert.equal(r.status, "unavailable");
  assert.equal(r.confidence, null);
  assert.equal(r.selectedSkill, null);
  assert.equal(r.alternatives[0].id, "repair");
});
test("provider failure retains partial trace and returns honest local suggestions", async () => {
  let n = 0;
  const r = await routeQuery("Review article", skills, {
    apiKey: "test",
    judge: async () => {
      if (n++) throw new Error("network unavailable");
      return answer("review");
    },
  });
  assert.equal(r.status, "unavailable");
  assert.equal(r.selectedSkill, null);
  assert.equal(r.trace.length, 1);
  assert.equal(r.alternatives[0].id, "edit");
});
test("provider responses reject foreign choices, malformed probabilities, and HTTP failures", async () => {
  const options = [
    { id: "review", name: "Review", description: "Review work" },
  ];
  for (const a of [
    answer("injected"),
    answer("review", 2),
    { ...answer("review"), probabilities: { review: -1 } },
    null,
  ])
    await assert.rejects(
      askJev("task", options, {
        apiKey: "test",
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({ answers: { next: a } }),
        }),
      }),
    );
  for (const probabilities of [
    {},
    [],
    { wrong: 1 },
    { review: 0, __none__: 1 },
    { review: 0.2, __none__: 0.2 },
    { review: 1, __none__: 0, extra: 0 },
  ])
    await assert.rejects(
      askJev("task", options, {
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({
            answers: { next: { ...answer("review"), probabilities } },
          }),
        }),
      }),
    );
  const valid = await askJev("task", options, {
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ answers: { next: answer("review") } }),
    }),
  });
  assert.equal(valid.choice, "review");
  await assert.rejects(
    askJev("task", options, {
      fetchImpl: async () => ({ ok: false, status: 401 }),
    }),
    /HTTP 401/,
  );
});
test("no lexical overlap produces an empty fallback instead of a random skill", () =>
  assert.deepEqual(rankLocally("blueberry pie", skills), []));
