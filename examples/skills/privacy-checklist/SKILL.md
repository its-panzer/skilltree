---
name: privacy-checklist
description: "Inspect a proposed source release for credentials, private records, embedded metadata, and historical exposure."
license: MIT
metadata:
  title: "Privacy check"
  version: "1.0.0"
  category: "review"
  branch: "Release quality"
  scope: "work"
---

# Privacy check

Fictional example for the Skilltree framework.

Define exactly what will be shared: a working tree, an archive, a branch, or a repository including its history. Inspect that release boundary.

## Review decisions

Check tracked files, generated media, configuration, and reachable commits for private material. Compare against known private inputs locally when available. Keep sensitive values out of the report itself.

## Deliverable

Report blocked paths and categories of exposure, then verify the corrected export. Distinguish automated pattern checks from manual review. An ignored file is excluded from normal commits, but that does not establish that earlier commits or uploaded artifacts are clean.
