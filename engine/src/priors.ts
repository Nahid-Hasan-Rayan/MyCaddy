// NHR: club spread priors implied by published within-5-yard rates
import { phi } from "./hazards";

export const YARD = 0.9144;

const SEVEN_IRON_MEAN_YD: [number, number][] = [[0, 178], [5, 164], [10, 161], [15, 154], [20, 146], [25, 132]];
const WITHIN_5_YD: [number, number][] = [[0, 0.185], [15, 0.14], [25, 0.125]];

function lerp(points: [number, number][], x: number): number {
  const h = Math.min(Math.max(x, points[0]![0]), points[points.length - 1]![0]);
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]!;
    const [x1, y1] = points[i]!;
    if (h <= x1) return y0 + ((y1 - y0) * (h - x0)) / (x1 - x0);
  }
  return points[points.length - 1]![1];
}

export function inverseNormal(p: number): number {
  let lo = -8;
  let hi = 8;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (phi(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function sigmaFromWithin(pWithin: number, tolerance: number): number {
  return tolerance / inverseNormal((1 + pWithin) / 2);
}

export function sevenIronSpreadYd(handicap: number): number {
  return sigmaFromWithin(lerp(WITHIN_5_YD, handicap), 5);
}

export function spreadPrior(handicap: number, clubMean: number): number {
  const cv = sevenIronSpreadYd(handicap) / lerp(SEVEN_IRON_MEAN_YD, handicap);
  return cv * clubMean;
}
