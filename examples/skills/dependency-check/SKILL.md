---
name: dependency-check
description: "Review a dependency update for compatibility, configuration changes, and security advisories relevant to the project."
license: MIT
metadata:
  title: "Dependency check"
  version: "1.0.0"
  category: "review"
  branch: "Code quality"
  scope: "work"
---

# Dependency check

Fictional example for the Skilltree framework.

Read the package manifest, lockfile change, and the code that uses the dependency. Consult the maintainer's release notes for the versions involved.

## Review decisions

Identify changed APIs, runtime requirements, and migration steps that affect this project. Assess security advisories against actual usage rather than treating every alert as equally reachable.

## Deliverable

List required changes and unresolved compatibility questions. Run the checks that exercise the dependency's role. State which versions and environments were tested. Avoid upgrading unrelated packages to make the diff appear current.
