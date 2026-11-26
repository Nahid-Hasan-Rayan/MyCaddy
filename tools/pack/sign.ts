// NHR: Ed25519 signing and verification for course packs
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import { signingBytes } from "./canonical";

const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function generateKeys() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ type: "spki", format: "der" });
  return {
    publicKey: Buffer.from(der.subarray(der.length - 32)).toString("base64"),
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}

export function signPack<T extends Record<string, unknown>>(pack: T, privatePem: string): T & { signature: string } {
  const sig = sign(null, signingBytes(pack), createPrivateKey(privatePem)).toString("base64");
  return { ...pack, signature: sig };
}

export function verifyPack(pack: Record<string, unknown>, publicKeyB64: string): boolean {
  const sig = pack["signature"];
  if (typeof sig !== "string") return false;
  try {
    const raw = Buffer.from(publicKeyB64, "base64");
    if (raw.length !== 32) return false;
    const key = createPublicKey({ key: Buffer.concat([SPKI_PREFIX, raw]), format: "der", type: "spki" });
    return verify(null, signingBytes(pack), key, Buffer.from(sig, "base64"));
  } catch {
    return false;
  }
}
