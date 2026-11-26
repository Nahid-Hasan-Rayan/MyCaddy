// NHR: score event shape shared by the app, engine and relay
import { z } from "zod";

export const ScoreEvent = z
  .object({
    id: z.string().min(1).max(64),
    playerId: z.string().min(1).max(64),
    hole: z.number().int().min(1).max(36),
    strokes: z.number().int().min(1).max(20),
    ts: z.number().int().min(0),
    kind: z.enum(["score", "correction"]).default("score"),
    supersedes: z.string().min(1).max(64).optional(),
    resolves: z.array(z.string().min(1).max(64)).max(8).optional(),
  })
  .refine((e) => e.kind === "correction" || e.resolves === undefined, {
    message: "only a correction can resolve other events",
    path: ["resolves"],
  })
  .refine((e) => e.kind !== "correction" || e.supersedes !== undefined, {
    message: "correction needs supersedes",
    path: ["supersedes"],
  });
export type ScoreEvent = z.infer<typeof ScoreEvent>;
