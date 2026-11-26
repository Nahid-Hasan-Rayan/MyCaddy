// NHR: hazard hand-calculation cases against the engine, printed as a table
import { fileURLToPath } from "node:url";
import { pHazard, pHazard2D, pShort, sigma, toFrame, fromMeters, type LatLng } from "../../engine/src/hazards";

export interface Case {
  name: string;
  expected: number;
  engine: () => number;
  how: string;
}

const o: LatLng = { lat: 1.56, lng: 103.64 };
const box = (e0: number, e1: number, n0: number, n1: number) => toFrame(o, fromMeters(o, 0, 200), [fromMeters(o, e0, n0), fromMeters(o, e1, n0), fromMeters(o, e1, n1), fromMeters(o, e0, n1)]);

export const cases: Case[] = [
  { name: "Short of 145 m (mean 150, sd 8, gps 4, geometry 3)", expected: 0.2980563, how: "Phi((145-150)/9.434) with Python math.erf", engine: () => pShort(145, 150, sigma(8, 4, 3)) },
  { name: "Land between 140 and 160 m, same club", expected: 0.7108544, how: "Phi(1.060)-Phi(-1.060) with Python math.erf", engine: () => pHazard(140, 160, 150, sigma(8, 4, 3)) },
  { name: "Land between 170 and 185 m (mean 165, sd 10, gps 5, geometry 8)", expected: 0.2851781, how: "Phi(1.455)-Phi(0.364) with Python math.erf", engine: () => pHazard(170, 185, 165, sigma(10, 5, 8)) },
  { name: "Small 4 x 4 m hazard at the mean, sigma 10 both ways", expected: 16 / (2 * Math.PI * 100), how: "area x peak density = 16 / (2 pi 100)", engine: () => pHazard2D(box(-2, 2, 148, 152), 150, 10, 10) },
  { name: "Wide hazard 140 to 160 m equals the depth-only value", expected: 0.7108544, how: "same as case 2 once the hazard is wider than 8 sigma", engine: () => pHazard2D(box(-100, 100, 140, 160), 150, sigma(8, 4, 3), sigma(8, 4, 3)) },
];

export function run(tol = 1e-3) {
  return cases.map((c) => {
    const got = c.engine();
    return { ...c, got, ok: Math.abs(got - c.expected) <= tol };
  });
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  console.log("| Case | Hand value | Engine | Match | Hand method |\n|---|---|---|---|---|");
  for (const r of run()) console.log(`| ${r.name} | ${(r.expected * 100).toFixed(2)}% | ${(r.got * 100).toFixed(2)}% | ${r.ok ? "yes" : "NO"} | ${r.how} |`);
}
