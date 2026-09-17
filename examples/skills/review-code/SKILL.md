---
name: review-code
description: "Review a code change for concrete regressions, failure paths, and missing behavioral coverage."
license: MIT
metadata:
  title: "Review code"
  version: "1.0.0"
  category: "review"
  branch: "Code quality"
  scope: "work"
---

# Review code

Fictional example for the Skilltree framework.

Read the change and its callers before reporting a finding. Use the surrounding contract to distinguish a defect from a stylistic preference.

## Review decisions

Trace the successful path, likely invalid inputs, and state changes. Check for authorization gaps, data loss, unintended repeated work, and behavior that diverges from the requested change. Confirm a suspected problem with a small reproduction when practical.

## Deliverable

Prioritize findings by impact. For each finding, identify the trigger, the observable consequence, and the relevant location. Separate verified failures from concerns that still need evidence. State what was checked even when no actionable issues were found.
