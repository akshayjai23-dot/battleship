# Bug log

Every bug found in this project is recorded here **as it is found**, not reconstructed at
the end. Each entry follows the same format:

- **Symptom** — what was observed.
- **Root cause** — why it actually happened.
- **Fix** — what changed.
- **Regression test** — the test that now fails if the bug comes back.

Two rules keep this document honest:

1. For every genuine bug, the failing test is committed **before** the fix, so the git
   history shows red-then-green.
2. Unfinished features are not bugs. Only defects in code that was believed complete are
   recorded here.

---

_No entries yet — the rules engine lands in PR #2._
