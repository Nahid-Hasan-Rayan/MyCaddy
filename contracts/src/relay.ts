// NHR: relay v1 websocket messages and lobby rules
import { z } from "zod";
import { ScoreEvent } from "./scoreEvent";

export const RULES = {
  maxPlayers: 4,
  codeLength: 6,
  codeAlphabet: "23456789ABCDEFGHJKMNPQRSTUVWXYZ",
  expiryHours: 12,
  deleteAfterHours: 24,
  joinAttemptsPerMinute: 10,
  maxBatch: 200,
  organiserId: "p1",
} as const;

const clean = (s: string) => s.replace(/[\p{Cc}\p{Cf}]/gu, "").trim();
const Name = z.string().max(120).transform(clean).pipe(z.string().min(1).max(24));
const Code = z.string().regex(new RegExp(`^[${RULES.codeAlphabet}]{${RULES.codeLength}}$`));
const Id = z.string().min(1).max(64);
const Mode = z.enum(["play", "competition"]);
const Lock = z.literal("competition").nullable();
const Batch = z.array(ScoreEvent).max(RULES.maxBatch);

export const Snapshot = z.object({
  mode: Mode,
  holes: z.union([z.literal(9), z.literal(18)]),
  lock: Lock,
  createdAt: z.number().int().min(0),
  expiresAt: z.number().int().min(0),
  players: z
    .array(z.object({ id: Id, name: Name, deviceId: Id, approved: z.boolean() }))
    .max(RULES.maxPlayers),
  events: Batch,
});
export type Snapshot = z.infer<typeof Snapshot>;

export const ClientMsg = z.discriminatedUnion("t", [
  z.object({ t: z.literal("create"), name: Name, mode: Mode, holes: z.union([z.literal(9), z.literal(18)]) }),
  z.object({
    t: z.literal("resume"),
    lobbyId: Id,
    code: Code,
    organiserToken: z.string().min(1).max(128),
    snapshot: Snapshot,
  }),
  z.object({ t: z.literal("join"), code: Code, name: Name, deviceId: Id }),
  z.object({ t: z.literal("approve"), playerId: Id, ok: z.boolean() }),
  z.object({ t: z.literal("events"), batch: Batch }),
  z.object({ t: z.literal("lock"), mode: Lock }),
  z.object({ t: z.literal("ping") }),
]);
export type ClientMsg = z.infer<typeof ClientMsg>;

export const ErrorCode = z.enum(["CAP", "EXPIRED", "DENIED", "RATE", "BAD", "UNKNOWN_LOBBY"]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ServerMsg = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("created"),
    lobbyId: Id,
    code: Code,
    inviteUrl: z.string().regex(/^https?:\/\//),
    expiresAt: z.number().int().min(0),
    organiserToken: z.string().min(1).max(128),
  }),
  z.object({ t: z.literal("pending"), playerId: Id, name: Name.optional(), deviceId: Id.optional() }),
  z.object({ t: z.literal("approved"), playerId: Id }),
  z.object({ t: z.literal("denied"), playerId: Id }),
  z.object({ t: z.literal("events"), batch: Batch }),
  z.object({
    t: z.literal("state"),
    players: z.array(z.object({ id: Id, name: Name, state: z.enum(["online", "offline", "away"]) })).max(RULES.maxPlayers),
    lock: Lock,
  }),
  z.object({ t: z.literal("error"), code: ErrorCode }),
]);
export type ServerMsg = z.infer<typeof ServerMsg>;

export type Parsed<T> = { ok: true; msg: T } | { ok: false; error: "BAD" };

function oversized(v: unknown, depth = 0): boolean {
  if (depth > 6 || v === null || typeof v !== "object") return depth > 6;
  if (Array.isArray(v)) return v.length > RULES.maxBatch || v.some((x) => oversized(x, depth + 1));
  return Object.values(v).some((x) => oversized(x, depth + 1));
}

function parseWith<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, raw: unknown): Parsed<T> {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return { ok: false, error: "BAD" };
    }
  }
  if (oversized(value)) return { ok: false, error: "BAD" };
  const r = schema.safeParse(value);
  return r.success ? { ok: true, msg: r.data } : { ok: false, error: "BAD" };
}

export const parseClient = (raw: unknown) => parseWith<ClientMsg>(ClientMsg, raw);
export const parseServer = (raw: unknown) => parseWith<ServerMsg>(ServerMsg, raw);
