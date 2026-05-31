export function finiteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function formatNumber(value) {
  const num = Number(value) || 0;
  if (num > 0 && num < 1) return num.toFixed(2).replace(".", ",");
  if (num >= 1 && num < 1000) return String(Math.floor(num));
  if (num <= 0) return "0";

  const units = ["тыс", "млн", "млрд", "трлн", "квдр", "квинт", "секст", "септ"];
  let index = -1;
  let short = Math.floor(num);
  while (short >= 1000 && index < units.length - 1) {
    short /= 1000;
    index += 1;
  }
  return short.toFixed(short >= 100 ? 0 : short >= 10 ? 1 : 2).replace(".", ",") + " " + units[index];
}

export function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function declStages(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "стадия";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "стадии";
  return "стадий";
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function softCap(raw, cap, factor) {
  return raw <= cap ? raw : cap + Math.sqrt(raw - cap) * factor;
}
