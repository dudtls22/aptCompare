import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOOKUP_PATH = path.join(__dirname, "..", "data", "kapt-lookup.json");

let lookupCache = null;

function normalizeAptName(name) {
  return String(name || "").replaceAll(" ", "").trim();
}

function normalizeDongName(name) {
  return String(name || "").replaceAll(" ", "").trim();
}

function readLookupFile() {
  try {
    if (fs.existsSync(LOOKUP_PATH)) {
      const raw = JSON.parse(fs.readFileSync(LOOKUP_PATH, "utf8"));
      return {
        byAptSeq: raw?.byAptSeq && typeof raw.byAptSeq === "object" ? raw.byAptSeq : {},
        byKey: raw?.byKey && typeof raw.byKey === "object" ? raw.byKey : {}
      };
    }
  } catch {
    /* ignore */
  }
  return { byAptSeq: {}, byKey: {} };
}

export function loadKaptLookup() {
  if (lookupCache) return lookupCache;
  lookupCache = readLookupFile();
  return lookupCache;
}

/**
 * @param {{ lawdCd?: string, dong?: string, apt?: string, bjdCode?: string, aptSeq?: string, kaptCode?: string }} cond
 */
export function resolveKaptCodeFromLookup(cond) {
  const explicit = String(cond?.kaptCode || "").trim();
  if (explicit) return explicit;

  const data = loadKaptLookup();
  const aptSeq = String(cond?.aptSeq || "").trim();
  if (aptSeq && data.byAptSeq[aptSeq]) return String(data.byAptSeq[aptSeq]).trim();

  const lawd = String(cond?.lawdCd || "").trim();
  const apt = String(cond?.apt || "").trim();
  const dong = String(cond?.dong || "").trim();
  const bjd = String(cond?.bjdCode || "").trim().slice(0, 10);
  const napt = normalizeAptName(apt);
  const ndong = normalizeDongName(dong);

  const candidates = [
    `${lawd}::${apt}::${dong}`,
    `${lawd}::${apt}`,
    `${bjd}::${apt}`,
    `${lawd}::${napt}::${ndong}`,
    `${lawd}::${napt}`,
    `${bjd}::${napt}`,
    napt
  ];
  for (const key of candidates) {
    if (key && data.byKey[key]) return String(data.byKey[key]).trim();
  }

  if (!napt) return "";

  for (const [key, code] of Object.entries(data.byKey)) {
    const parts = key.split("::");
    const namePart = normalizeAptName(parts[parts.length - 1]);
    if (namePart !== napt) continue;
    if (lawd && !key.startsWith(`${lawd}::`) && !key.startsWith(`${bjd}::`)) continue;
    if (ndong && parts.length >= 3) {
      const dongPart = normalizeDongName(parts[parts.length - 2]);
      if (dongPart && dongPart !== ndong && !ndong.includes(dongPart) && !dongPart.includes(ndong)) {
        continue;
      }
    }
    return String(code).trim();
  }

  return "";
}
