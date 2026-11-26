// NHR: course pack v1 and export v1
import { z } from "zod";
import { ScoreEvent } from "./scoreEvent";

export const LatLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

const Hazard = z.object({
  id: z.string().min(1).max(32),
  type: z.enum(["water", "bunker", "ob"]),
  polygon: z.array(LatLng).min(3).max(200),
});

const Hole = z.object({
  n: z.number().int().min(1).max(36),
  par: z.number().int().min(3).max(6),
  green: z.array(LatLng).max(100),
  tee: LatLng.optional(),
  hazards: z.array(Hazard).max(40),
  source: z.enum(["surveyed", "community", "virtual", "missing"]),
}).refine((h) => h.green.length === 0 || h.green.length >= 3, { message: "green needs 0 or at least 3 points", path: ["green"] });

export const CoursePack = z
  .object({
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(80),
    version: z.number().int().min(1),
    signature: z.string().min(1).max(200).optional(),
    simulatedHazards: z.boolean(),
    holes: z.array(Hole).min(1).max(36),
  })
  .refine((p) => p.simulatedHazards || !p.holes.some((h) => h.source === "virtual" && h.hazards.length > 0), {
    message: "virtual hazards must be labelled simulated",
    path: ["simulatedHazards"],
  });
export type CoursePack = z.infer<typeof CoursePack>;

const SECRET_KEY = /key|token|secret|password|auth/i;

export function findSecretKey(value: unknown, path = ""): string | null {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findSecretKey(value[i], `${path}[${i}]`);
      if (hit) return hit;
    }
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEY.test(k)) return `${path}.${k}`;
      const hit = findSecretKey(v, `${path}.${k}`);
      if (hit) return hit;
    }
  }
  return null;
}

export const ExportV1 = z
  .object({
    version: z.literal(1),
    events: z.array(ScoreEvent),
    settings: z.record(z.string(), z.unknown()),
    clubStats: z.record(z.string(), z.object({ mean: z.number(), sd: z.number(), count: z.number().int().min(0) })),
    holeHistory: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
  })
  .superRefine((e, ctx) => {
    const hit = findSecretKey(e);
    if (hit) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `secret-like key at ${hit}` });
  });
export type ExportV1 = z.infer<typeof ExportV1>;
