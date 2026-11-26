// NHR: seeded mock model that writes wording with allowed and invented numbers
export function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UNIT = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const TEEN = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const MUNIT = ["kosong", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "lapan", "sembilan"];

function underHundred(n: number): string {
  if (n < 10) return UNIT[n]!;
  if (n < 20) return TEEN[n - 10]!;
  return TENS[Math.floor(n / 10)]! + (n % 10 ? "-" + UNIT[n % 10] : "");
}
export function english(n: number): string {
  if (n < 100) return underHundred(n);
  const h = `${UNIT[Math.floor(n / 100)]} hundred`;
  return n % 100 ? `${h} and ${underHundred(n % 100)}` : h;
}
function malayUnder(n: number): string {
  if (n < 10) return MUNIT[n]!;
  if (n === 10) return "sepuluh";
  if (n === 11) return "sebelas";
  if (n < 20) return `${MUNIT[n - 10]} belas`;
  return `${MUNIT[Math.floor(n / 10)]} puluh` + (n % 10 ? ` ${MUNIT[n % 10]}` : "");
}
export function malay(n: number): string {
  if (n < 100) return malayUnder(n);
  const h = Math.floor(n / 100) === 1 ? "seratus" : `${MUNIT[Math.floor(n / 100)]} ratus`;
  return n % 100 ? `${h} ${malayUnder(n % 100)}` : h;
}
const shift = (n: number, zero: number) => String(n).replace(/\d/g, (d) => String.fromCodePoint(zero + Number(d)));

export type Format = "digits" | "unit" | "percent" | "english" | "malay" | "fullwidth" | "arabic" | "comma" | "decimal";
export const FORMATS: Format[] = ["digits", "unit", "percent", "english", "malay", "fullwidth", "arabic", "comma", "decimal"];

export function render(n: number, f: Format): string {
  switch (f) {
    case "unit": return `${n} m`;
    case "percent": return `${n}%`;
    case "english": return english(n);
    case "malay": return malay(n);
    case "fullwidth": return shift(n, 0xff10);
    case "arabic": return shift(n, 0x0660);
    case "comma": return n >= 1000 ? n.toLocaleString("en-US") : String(n);
    case "decimal": return Number.isInteger(n) ? `${n}.0` : String(n);
    default: return String(n);
  }
}

const FRAMES = [
  "Take the club that carries {0}, give or take {1}.",
  "The water starts {0} metres out and ends {1} metres out.",
  "Risk is {0} percent today, GPS is off by {1}.",
  "Ambil kayu yang membawa {0}, lebih kurang {1}.",
  "Hole {0}: {1} to the middle, wind is not a factor.",
  "{0} / {1}. Stay left of the bunker.",
];

export interface Case {
  text: string;
  allowed: number[];
  hasInvented: boolean;
}

export function mockModel(seed: number, count: number): Case[] {
  const r = rng(seed);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]!;
  const cases: Case[] = [];
  for (let i = 0; i < count; i++) {
    const a = 1 + Math.floor(r() * 399);
    let b = 1 + Math.floor(r() * 99);
    if (b === a) b++;
    const allowed = [a, b];
    const hasInvented = r() < 0.5;
    let first = a;
    let second = b;
    if (hasInvented) {
      const kind = pick(["random", "near", "swap", "extra"]);
      let bad = 1 + Math.floor(r() * 499);
      if (kind === "near") bad = a + (r() < 0.5 ? 1 : -1);
      if (kind === "swap") bad = Number(String(a).split("").reverse().join(""));
      if (allowed.includes(bad) || bad < 1) bad = 500 + Math.floor(r() * 400);
      if (kind === "extra") {
        let text = pick(FRAMES).replace("{0}", render(a, pick(FORMATS))).replace("{1}", render(b, pick(FORMATS)));
        text += ` Aim ${render(bad, pick(FORMATS))} up.`;
        cases.push({ text, allowed, hasInvented });
        continue;
      }
      if (r() < 0.5) first = bad;
      else second = bad;
    }
    const wordsOk = (n: number) => n <= 999;
    const f1 = pick(FORMATS.filter((f) => f !== "decimal" || true));
    const f2 = pick(FORMATS);
    const text = pick(FRAMES)
      .replace("{0}", wordsOk(first) ? render(first, f1) : String(first))
      .replace("{1}", wordsOk(second) ? render(second, f2) : String(second));
    cases.push({ text, allowed, hasInvented });
  }
  return cases;
}
