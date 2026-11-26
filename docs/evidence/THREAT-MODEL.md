# Threat model

Assets: score events, player names, the course pack, the organiser token, the AI proxy key.

| Threat | How it could happen | Effect | Control | Residual risk |
|---|---|---|---|---|
| Forwarded invite | The WhatsApp link is passed to a stranger | A stranger asks to join | Organiser approves every join, 4 player cap, 10 joins a minute per address, 12 hour expiry | An approved stranger sees names and scores of that lobby |
| Stolen or lost phone | Someone opens the app | Rounds, names and history visible | Encrypted local store in release builds, key in secure storage, erase-all in settings | Unlocked phone with the app open |
| Export file shared | The export is sent to the wrong person | History leaks | Export holds no keys or tokens (schema rejects them); user chooses where it goes | The content itself is personal data |
| Tampered course pack | A changed pack puts hazards in the wrong place | Wrong warnings | Ed25519 signature over canonical JSON, validator, public key inside the app | A leaked private key |
| Abused AI proxy | Someone calls the proxy directly | Quota burned, junk text | Allowlisted fields only, Competition refused, daily cap of 40, cache, fixed fallback, number guard in the app | Proxy can be switched off, static phrase bank is the default |
| Relay takeover after restart | Someone guesses a resume | Lobby hijack | Organiser token is an HMAC of the lobby id with a secret in the environment, compared in constant time | Secret leaked from the host |
| Message flood | A client sends thousands of messages | Relay slows for others | Per-socket token bucket, socket dropped after repeated refusals, 256 KB message limit, event cap per lobby | Many sockets from many addresses |
| Modified app in Competition | A player edits the client to skip the gate | Advice during a round | The lock is a Local Rule enforced by honour and the organiser, not by the relay | Cannot be fully prevented on a phone |
