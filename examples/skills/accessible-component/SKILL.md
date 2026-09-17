---
name: accessible-component
description: "Build a reusable interface component with semantic controls, keyboard behavior, and explicit interaction states."
license: MIT
metadata:
  title: "Accessible component"
  version: "1.0.0"
  category: "build"
  branch: "Interface systems"
  scope: "work"
---

# Accessible component

Fictional example for the Skilltree framework.

Start with the component's job and the project's existing primitives. Prefer native controls when their behavior fits the interaction.

## Design decisions

Define default, focused, disabled, loading, empty, and error states that the component actually needs. Keep labels available to assistive technology. For composite controls, specify where focus enters, moves, and returns.

## Deliverable

Implement the component and a small usage example. Verify the main keyboard path and a narrow layout. Explain any behavior that callers must provide, such as an accessible name or completion callback. Avoid adding a new design system for one component.
