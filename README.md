# MyCaddy Track B

Engine, contracts, servers and evidence tools for the MyCaddy prototype.
Author: Nahid Hasan Rayan.

## Layout

| Folder | What it holds |
|---|---|
| `engine/` | Pure TypeScript rules, hazard maths, twin and load logic. No react-native or expo imports. |
| `contracts/` | zod schemas, fixtures and `VERSION` for the relay, proxy, course pack and export. |
| `server/` | Relay (done, P2). Optional AI proxy later. |
| `tools/` | Trace collector and course facts now. Mock servers, pack tools and evidence scripts later. |
| `docs/` | Hosting limits, branch rules, course focus, generated trace table. |

## Install and run

```
npm ci
npm run typecheck
npm test
npm run trace
npm run engine:types
npx tsx tools/osm/coverage.ts path/to/export.geojson
npm run relay:sim
```

Node 22 or newer. `npm run trace` writes `docs/TRACE.md` and `docs/trace.json` from the `@TAG` markers in test titles.
`npm run engine:types` writes the `.d.ts` files to `engine/types/` for the app side.

## Rules for this repo

- Pure functions first, tests before wiring.
- Every server message is checked with zod. Unknown fields are dropped. Bad input gives `BAD`.
- Secrets only in environment variables.
- Bump `contracts/VERSION` on any contract change.
- Numbers and thresholds marked as proposals stay proposals until confirmed.
