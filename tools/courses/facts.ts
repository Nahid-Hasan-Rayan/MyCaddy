// NHR: course facts file shape (par, lengths, hazards the club page mentions)
import { z } from "zod";

export const CourseFacts = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    city: z.string().min(1),
    source: z.string().regex(/^https?:\/\//),
    checked: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    unit: z.enum(["m", "yd"]),
    teeSets: z.array(z.string().min(1)).min(1).max(6),
    holes: z
      .array(
        z.object({
          n: z.number().int().min(1).max(36),
          par: z.number().int().min(3).max(6),
          lengths: z.array(z.number().int().min(50).max(700)),
          mentionsWater: z.boolean(),
          mentionsBunkers: z.boolean(),
        })
      )
      .min(9)
      .max(36),
  })
  .superRefine((c, ctx) => {
    c.holes.forEach((h, i) => {
      if (h.n !== i + 1) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `hole ${i + 1} out of order` });
      if (h.lengths.length !== c.teeSets.length)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `hole ${h.n} needs ${c.teeSets.length} lengths` });
      for (let k = 1; k < h.lengths.length; k++)
        if (h.lengths[k]! > h.lengths[k - 1]!)
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `hole ${h.n} tee lengths must not increase` });
    });
  });
export type CourseFacts = z.infer<typeof CourseFacts>;

export function summary(c: CourseFacts) {
  const par = c.holes.reduce((a, h) => a + h.par, 0);
  const back = c.teeSets.map((_, k) => c.holes.reduce((a, h) => a + h.lengths[k]!, 0));
  return {
    par,
    totals: back,
    waterHoles: c.holes.filter((h) => h.mentionsWater).length,
    bunkerHoles: c.holes.filter((h) => h.mentionsBunkers).length,
  };
}
