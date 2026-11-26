// NHR: canonical json so a pack signs and verifies the same everywhere
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(o[k])}`).join(",")}}`;
}

export function signingBytes(pack: Record<string, unknown>): Buffer {
  const { signature: _signature, ...rest } = pack;
  return Buffer.from(canonicalize(rest), "utf8");
}
