// NHR: pack command line: keygen, sign, verify, validate, build, demo
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPack } from "./build";
import { campusDemo } from "./virtual";
import { generateKeys, signPack, verifyPack } from "./sign";
import { validatePack } from "./validate";

const [cmd, ...a] = process.argv.slice(2);
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const out = (p: string, v: unknown) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
const usage = () => {
  console.error("pack keygen <dir> | sign <pack> <private.pem> <out> | verify <pack> <public.txt> | validate <pack> [public.txt] [--require-signature] | build <export.geojson> <course name> <id> <out> | demo <lat> <lng> <out>");
  process.exit(2);
};

if (cmd === "keygen" && a[0]) {
  mkdirSync(a[0], { recursive: true });
  const k = generateKeys();
  writeFileSync(join(a[0], "pack-private.pem"), k.privateKey, { mode: 0o600 });
  writeFileSync(join(a[0], "pack-public.txt"), k.publicKey + "\n");
  console.log(`keys written to ${a[0]}; keep pack-private.pem out of git`);
} else if (cmd === "sign" && a.length === 3) {
  out(a[2]!, signPack(read(a[0]!), readFileSync(a[1]!, "utf8")));
  console.log("signed");
} else if (cmd === "verify" && a.length === 2) {
  const ok = verifyPack(read(a[0]!), readFileSync(a[1]!, "utf8").trim());
  console.log(ok ? "signature ok" : "signature INVALID");
  process.exit(ok ? 0 : 1);
} else if (cmd === "validate" && a[0]) {
  const key = a[1] && !a[1].startsWith("--") ? readFileSync(a[1], "utf8").trim() : undefined;
  const v = validatePack(read(a[0]), { publicKey: key, requireSignature: a.includes("--require-signature") });
  for (const e of v.errors) console.log(`error: ${e}`);
  for (const w of v.warnings) console.log(`warning: ${w}`);
  console.log(v.ok ? "pack ok" : "pack INVALID");
  process.exit(v.ok ? 0 : 1);
} else if (cmd === "build" && a.length === 4) {
  const { pack, report } = buildPack(read(a[0]!).features, { courseName: a[1]!, id: a[2]! });
  out(a[3]!, pack);
  console.log(JSON.stringify(report));
} else if (cmd === "demo" && a.length === 3) {
  out(a[2]!, campusDemo({ lat: Number(a[0]), lng: Number(a[1]) }));
  console.log("demo pack written, hazards are simulated");
} else usage();
