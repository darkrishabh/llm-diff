---
name: code-review
description: Review code changes for correctness, regressions, security risks, and missing tests. Use when asked to assess a diff, pull request, or implementation.
license: MIT
metadata:
  author: bench-ai
---

## Review focus

Lead with concrete findings. Prioritize defects that would change runtime behavior, break compatibility, weaken security, or leave important behavior untested.

## Output format

- Findings first, ordered by severity.
- Include file paths and line references when available.
- Keep summaries brief and separate from findings.

## Edge cases

If there are no issues, say that clearly and mention remaining test gaps or residual risk.
