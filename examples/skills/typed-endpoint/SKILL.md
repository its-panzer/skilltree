---
name: typed-endpoint
description: "Implement a small API endpoint with an explicit request contract, input validation, and predictable failures."
license: MIT
metadata:
  title: "Typed endpoint"
  version: "1.0.0"
  category: "build"
  branch: "Application code"
  scope: "work"
---

# Typed endpoint

Fictional example for the Skilltree framework.

Inspect the application's existing routing, authentication, and data-access conventions. Define the successful response and expected error cases before changing the handler.

## Implementation decisions

Validate at the request boundary. Reuse existing authorization checks and parameterized data access. Distinguish invalid input, missing resources, and unexpected server failures without returning secrets or internal stack traces.

## Verification

Exercise a valid request and the meaningful failure paths. Check that an unauthorized request cannot mutate data. Report the endpoint contract, behavior tested, and any required migration or configuration. Keep unrelated routes unchanged.
