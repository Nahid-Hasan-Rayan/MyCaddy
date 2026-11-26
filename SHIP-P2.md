# SHIP-P2 (relay)

Zip: `mycaddy-p2-server.zip` (whole repository, includes P1).

## Run

```
npm ci
npm test
npm run relay:sim        # four phones, one drop and rejoin, one relay restart
npm run relay:local      # relay on port 8080 for the hotspot fallback
```

## Deploy on Render (manual)

The relay imports `contracts/`, so build from the repository root, not from `server/relay`.

- New Web Service, connect the repository, root directory left empty
- Build command: `npm ci && npm run relay:build`
- Start command: `npm run relay:start`
- Health check path: `/health`
- Environment: `RELAY_SECRET` (any long random string, keep it fixed), `PUBLIC_URL` (the service URL)
- Then copy the `wss://` URL into `contracts/endpoints.json`

`RELAY_SECRET` must stay the same across restarts. The organiser token is derived from it, so a restarted relay can verify the organiser without storing anything.

## What the relay does

| Rule | Where tested |
|---|---|
| create, join with organiser approval, approve, deny | `relay.test.ts` |
| 4 players cap, 10 joins a minute per address, 12 hour expiry, delete after 24 hours | `relay.test.ts` |
| events deduped by id, forwarded once, never echoed back | `relay.test.ts` |
| organiser-only approve and lock | `relay.test.ts` |
| same device rejoins without approval and gets every event | `relay.test.ts` |
| state: online, offline, away | `relay.test.ts` |
| restart rebuilds the lobby from the organiser snapshot, wrong token or secret refused | `relay.test.ts` |
| real websockets, four phones, drop and rejoin, restart, 0 lost events | `lobby.e2e.test.ts` |
| bad json and bad messages return `BAD`, `/health` answers | `lobby.e2e.test.ts` |

No names or scores are logged. Nothing is written to disk.

## Contract changes (version 1.1.0)

- The organiser is always player `p1`.
- Server `pending` now carries `name` and `deviceId`, so the organiser can show who is asking and keep a complete snapshot for `resume`.

## Not done in P2

- Mock relay and mock proxy for the app side (the real relay runs locally with `npm run relay:local`)
- AI proxy and the English phrase bank
- Render deployment (manual, steps above)
