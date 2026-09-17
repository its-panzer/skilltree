---
name: test-fixture
description: "Create small deterministic test data that exposes a specific behavior without using production records."
license: MIT
metadata:
  title: "Test fixture"
  version: "1.0.0"
  category: "build"
  branch: "Developer tools"
  scope: "work"
---

# Test fixture

Fictional example for the Skilltree framework.

Identify the behavior under test and the smallest data shape that exercises it. Use invented values and explicit identifiers.

## Fixture design

Keep unrelated fields minimal. Include boundary values only when they reveal a real branch of behavior. Control timestamps and randomness so repeated runs are comparable. Name fixtures after the scenario they explain.

## Deliverable

Add the fixture beside the relevant tests and show how it is used. Verify that the test would fail for the intended regression. Avoid copying live customer data or making the expected result a restatement of the implementation.
