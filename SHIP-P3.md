# SHIP-P3, P4 and hardening

Zip: `mycaddy-p5-server.zip` (whole repository, P1 to P3).

```
npm ci
npm test
npm run relay:sim
```

| Item | Where | Tests |
|---|---|---|
| Canonical json, Ed25519 signer and verifier | `tools/pack/` | 16 in `pack.test.ts` |
| Validator CLI | `tools/pack/validate.ts`, `cli.ts` | included |
| Pack builder from an Overpass export | `tools/pack/build.ts` | included |
| Virtual demo course with simulated hazards | `tools/pack/virtual.ts` | included, checked against the engine |
| Policy audit over every type, mode, flag and ask | `engine/test/rules.audit.test.ts` | runs in CI |
| Number guard and 500-case fuzz | `engine/src/guard.ts`, `tools/fuzz/` | 0 leaks, 0 false rejects |
| Engine upgrades | 2D hazard risk, green distances, spread priors, club chart rule | 29 new |

Contracts are at 1.2.0 (holes may have no green).

## Not done

- CSV input for the pack builder
- Merging my existing engine and the three P1 fixes
- Real KLGCC West geometry (needs hand mapping)
- Packs signed with a real key: run `keygen` and keep the private key local

## P4 evidence scripts

| Script | Command | Output |
|---|---|---|
| GPS trace analysis (median, p90, accuracy calibration, plot) | `npx tsx tools/evidence/gps.ts readings.csv` | `gps-report.md`, `gps-report.svg` |
| Twin evaluation on seeded golfers | `npx tsx tools/evidence/twin-eval.ts` | error table by shots |
| Hazard hand cases against the engine | `npx tsx tools/evidence/hazard-cases.ts` | markdown table |
| Spread and GPS sensitivity | `npx tsx tools/evidence/sensitivity.ts` | risk table |

GPS csv columns: `point,true_lat,true_lng,lat,lng,accuracy_m`. Procedures and templates: `docs/evidence/` (battery, kill-restart log, threat model). Decisions: `docs/ADR.md` (ADR-08 to ADR-14).

The relay now also drops sockets that flood it (burst 60, refill 20 a second).

## Hardening (after a self-audit)

Fixed: joining with the organiser's device id gave organiser rights; one address could create unlimited lobbies; events for players not in the lobby were accepted. Added: 64 KB message cap, per-socket rate limit, per-address connection cap, close sockets that never join, browser origin allow-list (`ALLOWED_ORIGINS`), name cleaning, counters on `/health`, graceful shutdown.

Checks: `npm run quality:mutate` (23 of 23 mutants caught), `npm run quality:probe -- wss://your-relay` (black-box abuse probe, works on any relay), coverage gate in CI.

Contracts 1.3.0: `resolves` lets one correction settle several competing scores. `conflicts()` in `engine/src/scoring.ts` lists them for a conflict card.
