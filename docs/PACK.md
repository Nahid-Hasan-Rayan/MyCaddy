# Course pack tools

Format: `CoursePack` in `contracts/src/pack.ts` (contracts 1.2.0). A hole may have no green, and a hole with no green and no hazards must be marked `missing`.

## Signing

- Ed25519. The signed bytes are the canonical JSON of the pack without its `signature` field: keys sorted, no whitespace, `undefined` dropped (`tools/pack/canonical.ts`). The app must rebuild the same bytes before verifying.
- `signature` is base64 of the 64-byte signature (88 characters). The public key is 32 raw bytes in base64 and ships inside the app.
- The private key stays out of git (`keys/` and `*.pem` are ignored).

## Commands

```
npm run pack -- keygen keys
npm run pack -- demo <lat> <lng> packs/demo.json
npm run pack -- build export.geojson "Course name" course-id packs/course.json
npm run pack -- sign packs/demo.json keys/pack-private.pem packs/demo.signed.json
npm run pack -- validate packs/demo.signed.json keys/pack-public.txt --require-signature
npm run pack -- verify packs/demo.signed.json keys/pack-public.txt
```

## What the validator checks

Schema, hole order, hazard ids, polygons with no area or crossing themselves, missing holes that still carry geometry, silent holes not marked missing, green size, hazards over 800 m away, and the signature.

## Limits

`build` needs `golf=hole` lines with a `ref` number. The KLGCC export has none, so it stops with a clear message instead of guessing. Hole par comes from a `par` tag if present, otherwise 4.
