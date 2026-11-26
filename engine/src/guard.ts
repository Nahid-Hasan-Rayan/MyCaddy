// NHR: number guard, rejects any number in wording that is not in the facts
const EN_UNIT: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
const EN_TEEN: Record<string, number> = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const EN_TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const MS_UNIT: Record<string, number> = { kosong: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, lapan: 8, sembilan: 9 };
const MS_TEEN: Record<string, number> = { sepuluh: 10, sebelas: 11 };

export interface GuardResult {
  ok: boolean;
  invented: number[];
}

const FRACTIONS: Record<string, string> = { "½": " 0.5 ", "¼": " 0.25 ", "¾": " 0.75 " };

function asciiDigits(text: string): string {
  return text.replace(/[½¼¾]/g, (c) => FRACTIONS[c]!).normalize("NFKC").replace(/\p{Nd}/gu, (c) => {
    let cp = c.codePointAt(0)!;
    let start = cp;
    while (/\p{Nd}/u.test(String.fromCodePoint(start - 1))) start--;
    return String((cp - start) % 10);
  });
}

function digitNumbers(token: string): number[] {
  if (/^\d{1,3}(,\d{3})+$/.test(token)) return [Number(token.replace(/,/g, ""))];
  const parts = token.split(/[.,]/);
  if (parts.length === 2) return [Number(`${parts[0]}.${parts[1]}`)];
  return parts.map(Number);
}

export function numbersIn(text: string): number[] {
  const out: number[] = [];
  const tokens = asciiDigits(text).toLowerCase().match(/\d+(?:[.,]\d+)*|\p{L}+|[^\s\-]/gu) ?? [];
  let active = false;
  let total = 0;
  let small = 0;
  let unit = 0;
  let last = "";
  const flush = () => {
    if (active) out.push(total + small + unit);
    active = false;
    total = small = unit = 0;
    last = "";
  };
  const start = () => {
    active = true;
  };
  for (const t of tokens) {
    if (/^\d/.test(t)) {
      flush();
      out.push(...digitNumbers(t));
    } else if (t in EN_UNIT || t in MS_UNIT) {
      const v = EN_UNIT[t] ?? MS_UNIT[t]!;
      if (active && last !== "tens" && last !== "hundred") flush();
      start();
      unit = v;
      last = "unit";
    } else if (t in EN_TEEN || t in MS_TEEN) {
      if (active && last !== "hundred") flush();
      start();
      small += EN_TEEN[t] ?? MS_TEEN[t]!;
      last = "teen";
    } else if (t in EN_TENS) {
      if (active && last !== "hundred") flush();
      start();
      small += EN_TENS[t]!;
      last = "tens";
    } else if (t === "hundred" || t === "thousand") {
      if (!active || last === "tens") flush();
      start();
      const base = small + unit || 1;
      total += base * (t === "hundred" ? 100 : 1000);
      small = unit = 0;
      last = "hundred";
    } else if (t === "seratus" || t === "seribu") {
      flush();
      start();
      total += t === "seratus" ? 100 : 1000;
      last = "hundred";
    } else if (t === "puluh" && active && last === "unit") {
      small += unit * 10;
      unit = 0;
      last = "tens";
    } else if (t === "belas" && active && last === "unit") {
      small += 10 + unit;
      unit = 0;
      last = "teen";
    } else if ((t === "ratus" || t === "ribu") && active && last === "unit") {
      total += unit * (t === "ratus" ? 100 : 1000);
      unit = 0;
      last = "hundred";
    } else if ((t === "and" || t === "dan") && active && last === "hundred") {
      continue;
    } else flush();
  }
  flush();
  return out;
}

export function guard(text: string, allowed: number[], tolerance = 0): GuardResult {
  const invented = numbersIn(text).filter((n) => !allowed.some((a) => Math.abs(a - n) <= tolerance));
  return { ok: invented.length === 0, invented };
}
