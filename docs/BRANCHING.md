# Branch rules (solo work)

- `main` is always green. Nothing is pushed to it directly.
- Work on short branches named `p1/engine-hazards`, `p2/relay-resume` and so on.
- Open a pull request into `main` even when working alone. CI runs typecheck and tests.
- Merge only when CI is green. Use squash merge so `main` has one commit per feature.
- Tag each phase when its zip is made: `p1`, `p2`, ...

GitHub setup (Settings, Rules, New branch ruleset):

1. Target branch: `main`.
2. Require a pull request before merging (0 approvals is fine for solo work).
3. Require status checks to pass, and pick the `check` job from the `ci` workflow.
4. Block force pushes and deletion.
