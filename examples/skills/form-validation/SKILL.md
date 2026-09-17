---
name: form-validation
description: "Add usable client and server validation to a form, preserving entered values and actionable field errors."
license: MIT
metadata:
  title: "Form validation"
  version: "1.0.0"
  category: "build"
  branch: "Application code"
  scope: "work"
---

# Form validation

Fictional example for the Skilltree framework.

Read the form's submission path and server contract. Separate formatting help from requirements that must be enforced on the server.

## Interaction decisions

Associate each error with its field. Preserve entered values after failure and move focus only when it helps the user recover. Do not reject an otherwise valid submission because of a speculative format rule.

## Verification

Check a successful submission, invalid input, and a server error. Verify keyboard access and that repeated submission does not accidentally duplicate work. Summarize the validation rules in plain language.
