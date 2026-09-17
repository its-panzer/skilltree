export const categories = [
  {
    id: "content",
    name: "Content",
    verb: "Make something worth reading.",
    description:
      "Write, explain, edit, tell stories, create video and visual content.",
    color: "#a67442",
    icon: "feather",
  },
  {
    id: "build",
    name: "Build",
    verb: "Turn an idea into a working thing.",
    description:
      "Code, design interfaces, build apps, configure Xcode, and choose models or agent architecture.",
    color: "#547e84",
    icon: "code",
  },
  {
    id: "review",
    name: "Review",
    verb: "Make the work hold up.",
    description:
      "Audit quality, review articles or product flows, test, verify, critique, and evaluate.",
    color: "#8473a0",
    icon: "shield",
  },
  {
    id: "research",
    name: "Research",
    verb: "Follow the evidence.",
    description:
      "Investigate topics, learn, analyze performance and markets, compare sources, and form strategy.",
    color: "#5b825b",
    icon: "compass",
  },
  {
    id: "operate",
    name: "Operate",
    verb: "Keep the work moving.",
    description:
      "Manage workflows, coordinate projects, report status, publish content, sync systems, and plan work.",
    color: "#b27264",
    icon: "workflow",
  },
  {
    id: "life",
    name: "Life",
    verb: "Look after the everyday.",
    description:
      "Personal household maintenance, device repairs, career opportunities, focus, and life planning.",
    color: "#878343",
    icon: "sun",
  },
];

export function treeFor(skills) {
  return {
    id: "root",
    name: "Skilltree",
    type: "root",
    children: categories.map((category) => ({
      ...category,
      type: "category",
      count: skills.filter((s) => s.category === category.id).length,
      children: [
        ...new Set(
          skills.filter((s) => s.category === category.id).map((s) => s.branch),
        ),
      ]
        .sort()
        .map((branch) => ({
          id: `${category.id}/${branch}`,
          name: branch,
          type: "branch",
          children: skills
            .filter((s) => s.category === category.id && s.branch === branch)
            .map((s) => ({
              id: s.id,
              name: s.title,
              type: "skill",
              version: s.version,
              scope: s.scope,
            })),
        })),
    })),
  };
}
