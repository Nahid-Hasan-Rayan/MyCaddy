// NHR: GPS trace analysis at marked points: median, p90, accuracy calibration, cdf plot
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { haversine } from "../../engine/src/hazards";
import { RADIUS68_TO_SIGMA } from "../../engine/src/hazards";

export interface Reading {
  point: string;
  trueLat: number;
  trueLng: number;
  lat: number;
  lng: number;
  accuracy: number;
}

export function parseCsv(text: string): Reading[] {
  const lines = text.trim().split(/\r?\n/);
  const head = lines.shift()!.split(",").map((h) => h.trim());
  const col = (n: string) => head.indexOf(n);
  const need = ["point", "true_lat", "true_lng", "lat", "lng", "accuracy_m"];
  for (const n of need) if (col(n) < 0) throw new Error(`missing column ${n}`);
  return lines
    .filter((l) => l.trim())
    .map((l, i) => {
      const c = l.split(",").map((x) => x.trim());
      const r: Reading = { point: c[col("point")]!, trueLat: Number(c[col("true_lat")]), trueLng: Number(c[col("true_lng")]), lat: Number(c[col("lat")]), lng: Number(c[col("lng")]), accuracy: Number(c[col("accuracy_m")]) };
      if ([r.trueLat, r.trueLng, r.lat, r.lng, r.accuracy].some((v) => !Number.isFinite(v))) throw new Error(`bad number on row ${i + 2}`);
      return r;
    });
}

const quantile = (sorted: number[], q: number) => {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  return sorted[lo]! + (sorted[Math.ceil(pos)]! - sorted[lo]!) * (pos - lo);
};

export interface GpsStats {
  n: number;
  points: number;
  median: number;
  mean: number;
  p90: number;
  max: number;
  within5: number;
  withinReported: number;
  sigmaMeasured: number;
  sigmaFromReported: number;
  errors: number[];
}

export function analyse(rows: Reading[], target = 5): GpsStats {
  if (!rows.length) throw new Error("no readings");
  const errors = rows.map((r) => haversine({ lat: r.trueLat, lng: r.trueLng }, { lat: r.lat, lng: r.lng }));
  const sorted = [...errors].sort((a, b) => a - b);
  const n = rows.length;
  const rms = Math.sqrt(errors.reduce((a, e) => a + e * e, 0) / n);
  const meanAcc = rows.reduce((a, r) => a + r.accuracy, 0) / n;
  return {
    n,
    points: new Set(rows.map((r) => r.point)).size,
    median: quantile(sorted, 0.5),
    mean: errors.reduce((a, e) => a + e, 0) / n,
    p90: quantile(sorted, 0.9),
    max: sorted[n - 1]!,
    within5: errors.filter((e) => e <= target).length / n,
    withinReported: rows.filter((r, i) => errors[i]! <= r.accuracy).length / n,
    sigmaMeasured: rms / Math.SQRT2,
    sigmaFromReported: meanAcc * RADIUS68_TO_SIGMA,
    errors,
  };
}

export function cdfSvg(errors: number[], target = 5): string {
  const s = [...errors].sort((a, b) => a - b);
  const xmax = Math.max(10, Math.ceil(s[s.length - 1]!));
  const W = 480, H = 280, L = 48, B = 36;
  const x = (v: number) => L + (v / xmax) * (W - L - 16);
  const y = (f: number) => H - B - f * (H - B - 16);
  const pts = s.map((e, i) => `${x(e).toFixed(1)},${y((i + 1) / s.length).toFixed(1)}`).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="sans-serif" font-size="11"><rect width="${W}" height="${H}" fill="white"/><line x1="${L}" y1="${y(0)}" x2="${W - 16}" y2="${y(0)}" stroke="#888"/><line x1="${L}" y1="${y(0)}" x2="${L}" y2="${y(1)}" stroke="#888"/><line x1="${x(target)}" y1="${y(0)}" x2="${x(target)}" y2="${y(1)}" stroke="#c0392b" stroke-dasharray="4 3"/><line x1="${L}" y1="${y(0.9)}" x2="${W - 16}" y2="${y(0.9)}" stroke="#bbb" stroke-dasharray="2 3"/><polyline fill="none" stroke="#2F6FB7" stroke-width="2" points="${pts}"/><text x="${x(target) + 4}" y="${y(0.08)}" fill="#c0392b">${target} m target</text><text x="${L + 4}" y="${y(0.9) - 4}" fill="#666">90%</text><text x="${W / 2 - 40}" y="${H - 8}">error in metres</text><text x="6" y="${y(1) + 4}">100%</text><text x="${L - 14}" y="${y(0) + 14}">0</text><text x="${W - 40}" y="${y(0) + 14}">${xmax}</text></svg>\n`;
}

export function report(st: GpsStats, label: string, target = 5): string {
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  return [
    `# GPS check: ${label}`,
    "",
    `${st.n} readings at ${st.points} marked points. Values are horizontal error in metres.`,
    "",
    "| Measure | Value |",
    "|---|---|",
    `| Median error | ${st.median.toFixed(2)} |`,
    `| Mean error | ${st.mean.toFixed(2)} |`,
    `| 90th percentile | ${st.p90.toFixed(2)} |`,
    `| Largest error | ${st.max.toFixed(2)} |`,
    `| Within ${target} m | ${pct(st.within5)} (target 90%) |`,
    `| Within the reported accuracy radius | ${pct(st.withinReported)} (expect about 68% if the radius is a 68% radius) |`,
    `| One-axis sigma from the errors | ${st.sigmaMeasured.toFixed(2)} |`,
    `| One-axis sigma from the reported radius | ${st.sigmaFromReported.toFixed(2)} |`,
    "",
    st.withinReported > 0.8 ? "The phone is under-confident: its reported radius is larger than the real error." : st.withinReported < 0.55 ? "The phone is over-confident: real errors are larger than the reported radius." : "The reported radius is about right.",
    "",
  ].join("\n");
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const [file, out = "gps-report"] = process.argv.slice(2);
  if (!file) {
    console.error("usage: npx tsx tools/evidence/gps.ts readings.csv [output-name]");
    process.exit(1);
  }
  const st = analyse(parseCsv(readFileSync(file, "utf8")));
  writeFileSync(`${out}.md`, report(st, file));
  writeFileSync(`${out}.svg`, cdfSvg(st.errors));
  console.log(report(st, file));
}
