// NHR: twin evaluation on seeded golfers, error against number of shots
import { fileURLToPath } from "node:url";
import { twinClub } from "../../engine/src/twin";
import { spreadPrior, YARD } from "../../engine/src/priors";
import { rng } from "../fuzz/mockModel";

export interface EvalRow {
  shots: number;
  meanRmse: number;
  sdRmse: number;
}

export function evaluate(golfers = 300, steps = [0, 1, 3, 5, 10, 20, 40], seed = 99): EvalRow[] {
  const r = rng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r());
  const acc = steps.map(() => ({ m: 0, s: 0 }));
  for (let g = 0; g < golfers; g++) {
    const trueMean = 154 * YARD * (0.85 + 0.3 * r());
    const priorMean = trueMean * 1.07;
    const prior = { mean: priorMean, sd: spreadPrior(15, priorMean), strength: 5 };
    const trueSd = prior.sd * (0.5 + 0.5 * r());
    const shots = Array.from({ length: Math.max(...steps) }, () => trueMean + trueSd * gauss());
    steps.forEach((n, i) => {
      const t = twinClub(shots.slice(0, n), prior);
      acc[i]!.m += (t.mean - trueMean) ** 2;
      acc[i]!.s += (t.sd - trueSd) ** 2;
    });
  }
  return steps.map((n, i) => ({ shots: n, meanRmse: Math.sqrt(acc[i]!.m / golfers), sdRmse: Math.sqrt(acc[i]!.s / golfers) }));
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  console.log("shots  mean error (m)  spread error (m)");
  for (const r of evaluate()) console.log(`${String(r.shots).padEnd(5)}  ${r.meanRmse.toFixed(2).padStart(13)}  ${r.sdRmse.toFixed(2).padStart(16)}`);
}
