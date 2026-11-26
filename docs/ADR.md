# Architecture decisions

## ADR-08 Organiser token is a keyed hash, not stored state
The relay keeps nothing on disk and can restart at any time. The organiser token is HMAC-SHA256 of the lobby id with a secret from the environment, so a restarted relay can verify the organiser without a database. Cost: the secret must stay fixed across restarts.

## ADR-09 The phones own the data, the relay forwards
Clients keep every score event and re-send after a reconnect. The relay dedupes by event id, holds events in memory and forgets everything after 24 hours. This tolerates free-host restarts at the cost of larger resume messages (up to 200 events).

## ADR-10 Course packs are signed with Ed25519 over canonical JSON
A pack is trusted only if its signature verifies against a key inside the app. Canonical JSON (sorted keys, no whitespace) makes the signed bytes identical on the build tool and on the phone. Cost: the app needs a pure JavaScript Ed25519 verifier, because the Node crypto module is not available there.

## ADR-11 Hazard risk is a two-dimensional normal model with geometry error by source
Along and sideways shot spread are integrated over the hazard polygon. Geometry error depends on the data source (surveyed 3 m, community 8 m, virtual 0 m, all proposals). GPS accuracy is converted from a 68% radius to a one-axis sigma. Cost: a grid integration per hazard, kept under about 22,500 cells.

## ADR-12 Spread priors from published data, replaced by the player's own shots
Starting spread comes from the Shot Scope within-5-yard rate, scaled by club distance. Each club then shrinks toward the player's shots (prior strength 5). Cost: the prior is high-side until real data arrives, and a normal curve ignores heavy tails.

## ADR-13 The rules matrix follows Rule 4.3 and is data, not code
Message types are allowed per mode from one table, with a separate column when distance devices are banned. A club distance chart from prior rounds is the only history-based message allowed in Competition. Cost: the table is a proposal until a referee confirms it.

## ADR-14 Wording is fixed templates and a static phrase bank, with a strict number guard
Any text that reaches the player passes a guard that rejects every number not in the facts, including number words in English and Malay and non-ASCII digits. The AI proxy is optional and off in Competition. Cost: the guard also rejects harmless numbers such as "one more club" unless the fact is supplied.

## ADR-15 Stay on zod 3 for now, bound the input instead
The audit flags zod below 4.6.6 for memory exhaustion on oversized constrained collections. Moving to zod 4 changes the contracts package that the app also uses, so both tracks must move together. Until then the relay caps every message at 64 KB before parsing, array fields have maximum lengths, and any array longer than 200 items is refused before the schema runs. Without that pre-check a 64 KB message of 21,000 empty objects cost about 500 ms of CPU, which a flood could repeat. With it the same message is rejected in a few milliseconds, and a test enforces that. Revisit when the app side can upgrade.
