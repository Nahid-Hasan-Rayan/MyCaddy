// NHR: how hazard risk moves with the club spread prior and the GPS accuracy reading
import { fileURLToPath } from "node:url";
import { band, gpsSigmaFromRadius68, pHazard, sigma } from "../../engine/src/hazards";

export interface Row {
  sd: number;
  gps: string;
  p: number;
  band: string;
}

export function table(mean: number, near: number, far: number, radius: number, geometry: number): Row[] {
  const rows: Row[] = [];
  for (const sd of [8, 12, 25]) {
    for (const [gps, a] of [["radius used as sigma", radius], ["radius converted", gpsSigmaFromRadius68(radius)]] as const) {
      const p = pHazard(near, far, mean, sigma(sd, a, geometry));
      rows.push({ sd, gps, p, band: band(p) });
    }
  }
  return rows;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const cases: [string, number, number, number][] = [
    ["water 150 to 165 m, mean 135 m", 135, 150, 165],
    ["bunker 125 to 140 m, mean 135 m", 135, 125, 140],
  ];
  for (const [name, mean, near, far] of cases) {
    console.log(`\n${name}, GPS radius 6 m, geometry error 3 m`);
    console.log("spread  gps reading            risk    band");
    for (const r of table(mean, near, far, 6, 3)) console.log(`${String(r.sd).padEnd(6)}  ${r.gps.padEnd(20)}  ${(r.p * 100).toFixed(1).padStart(5)}%  ${r.band}`);
  }
}
