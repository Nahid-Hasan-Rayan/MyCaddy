// NHR: ai proxy v1 request and response, no competition mode
import { z } from "zod";

export const ProxyFacts = z.object({
  kind: z.enum(["club_advice", "hazard_warning", "tee_insight"]),
  club: z.string().min(1).max(20).optional(),
  distance: z.number().min(0).max(400).optional(),
  plusMinus: z.number().min(0).max(50).optional(),
  poorGps: z.boolean().optional(),
  reasons: z.array(z.string().min(1).max(40)).max(5).optional(),
});

export const ProxyReq = z.object({
  facts: ProxyFacts,
  lang: z.enum(["en", "ms"]),
  mode: z.enum(["learn", "relax", "play", "practice"]),
});
export type ProxyReq = z.infer<typeof ProxyReq>;

export const ProxyRes = z.object({
  text: z.string().min(1).max(240),
  source: z.enum(["model", "fixed", "cache"]),
});
export type ProxyRes = z.infer<typeof ProxyRes>;
