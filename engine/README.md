# Engine v0.2 (new modules)

| File | Purpose |
|---|---|
| `src/rules.ts` | Rules matrix from R2 as data. `isAllowed(type, mode, flags, ask)`. Banned inputs list. |
| `src/hazards.ts` | Normal cdf, sigma, hazard probability and bands. Shot-line geometry against polygons. |
| `src/twin.ts` | Club shrinkage, quality labels, hole miss tendency, drift flag. |
| `src/load.ts` | Behaviour-only load score, talk level, speech guard. |

Proposal values (change in one place each): `GEOMETRY_ERROR` in hazards, `LEARNING_AT`, `RELIABLE_AT`, `MIN_VISITS`, `MAJORITY`, `RECENT`, `DRIFT_SD` in twin, `WEIGHTS` and the 30/60 edges in load.

Known limit: the hazard probability covers distance along the shot line only. It does not model left or right dispersion.
