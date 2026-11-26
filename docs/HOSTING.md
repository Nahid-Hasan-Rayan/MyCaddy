# Hosting limits and data terms

Checked on 2026-11-20. Re-check before the demo and before citing in the report. Limits below are what the vendors' pages said on that day.

## Render (relay)

| Item | Finding | Effect on MyCaddy |
|---|---|---|
| Idle spin-down | Free web service sleeps after 15 min with no inbound traffic. Messages on an open WebSocket count as traffic. | A lobby in use stays awake. Start the service 5 min before any demo. |
| Cold start | About one minute to wake on the next HTTP request or new WebSocket. | First join after idle is slow. Show a "waking server" state in the app. |
| Filesystem | Ephemeral. Lost on redeploy, restart and spin-down. | Relay keeps everything in memory only. `resume` rebuilds a lobby. |
| Restarts | Render may restart a free service at any time. | Same as above. Clients keep all events and re-send. |
| Hours | 750 free instance hours per workspace per month. Sleeping services do not use hours. | One relay is fine. Do not add more free services. |
| Traffic | A free service that starts uncommonly high outbound traffic may be suspended. | Relay only forwards small JSON. No external calls. |

Source: render.com/docs/free

## OpenRouter (optional proxy)

| Item | Finding | Effect on MyCaddy |
|---|---|---|
| Free model limits | 20 requests per minute, 50 per day on any `:free` model. The daily cap becomes 1,000 once the account has ever bought $10 of credit. I stay on the free side. | Daily budget counter stays at 40. |
| Failed requests | Failed requests can still count against the daily allowance. | Count attempts, not successes. Cap retries at 1. |
| Data policy | Free models are often served by hosts with their own data rules, and some may train on prompts. | Send `provider.data_collection: "deny"`. Pick a model whose host allows that, record it below. |
| Key | Limits belong to the account, not the model. | One key, env var only. |

Sources: openrouter.zendesk.com help article on limits, truefoundry write-up of OpenRouter limits (Oct 2026).

Chosen model and host data policy: to fill in when the proxy is built (P2).

## Vercel (optional proxy)

| Item | Finding | Effect on MyCaddy |
|---|---|---|
| Plan | Hobby is free but limited to non-commercial personal use. | Fine for coursework. Say so in the report. |
| Function time | Pages disagreed on the Hobby maximum (older 10 s default, newer 300 s). | Proxy needs a few seconds only. Set a 5 s timeout and fixed fallback. Confirm in the dashboard. |
| Usage cap | Going over a free limit means waiting until the period resets. | Daily budget counter keeps traffic tiny. |

Source: vercel.com/docs/plans/hobby

## Open items

- Pick the OpenRouter model and record its host data policy.
- Confirm the Vercel function limit in the project settings.
- Set the Render health check path to `/health`.
