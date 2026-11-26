# SHIP-P1

Zip: `mycaddy-p1-server.zip`

## Run

```
npm ci
npm run typecheck
npm test
npm run trace
npm run engine:types
```

## Status against the P1 brief

| Item | State |
|---|---|
| Public repo, branch rules, CI | CI file and branch rules written. Repo creation and the GitHub ruleset are manual (see `docs/BRANCHING.md`). |
| Render, Vercel, OpenRouter setup | Manual. Limits and data terms recorded in `docs/HOSTING.md`. |
| `contracts/` v1 with zod, fixtures, tests | Done. 30 tests. `ScoreEvent` shape is provisional. |
| Rules matrix as data with devices-banned level | Done in `engine/src/rules.ts`. |
| New `hazards.ts`, `twin.ts`, `load.ts` | Done with tests. |
| New message types | In `rules.ts`: `hazard_distance`, `hazard_warning`, `twin_insight`, `debrief`. `game_plan` is in the matrix. The three type names the brief lists as new for `policy` still need to be added to the existing policy module. |
| `tools/trace` | Done. |
| Fix: dedupe events by id in `scoring` | Not done. Needs the existing engine source. |
| Fix: role-aware one-use number guard in `phrases` | Not done. Needs the existing engine source. |
| Fix: `Record<MessageType, Policy>` in `policy` | Not done. Needs the existing engine source. `MessageType` in `rules.ts` is the list to use. |
| `// NHR:` marker in every file | Done for all files here. Existing engine files still need it. |
| Audit shows 0 leaks | Done for the rules matrix (`rules.audit.test.ts`). The audit over the existing policy module is P3. |
| Update README and CI for solo work | Done. |

## Course focus

See `docs/COURSES.md`. KLGCC West facts are in `tools/courses/`. The other two courses are not chosen yet.

## Next

1. Copy the existing `engine/` files in, merge `rules.ts` with `policy`, apply the three fixes.
2. Replace `contracts/src/scoreEvent.ts` with the real engine event type if it differs.
3. Create the GitHub repo and ruleset, then the Render and Vercel projects.
4. Start P2 (relay).
