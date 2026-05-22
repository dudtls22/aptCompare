/**
 * 공공데이터포털 '공동주택 단지 목록' CSV → data/kapt-lookup.json
 * 사용: node scripts/import-kapt-csv.mjs path/to/list.csv
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "data", "kapt-lookup.json");

function normalizeAptName(name) {
  return String(name || "").replaceAll(" ", "").trim();
}

function pick(row, keys) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim()) return String(row[k]).trim();
  }
  return "";
}

function parseCsvLine(line) {
  const cols = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === "," && !inQ) {
      cols.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

const csvPath = process.argv[2];
if (!csvPath || !fs.existsSync(csvPath)) {
  console.error("Usage: node scripts/import-kapt-csv.mjs <csv-file>");
  process.exit(1);
}

const text = fs.readFileSync(csvPath, "utf8");
const lines = text.split(/\r?\n/).filter((l) => l.trim());
const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
const idx = (names) => {
  for (const n of names) {
    const i = header.indexOf(n.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
};

const iCode = idx(["kaptcode", "kapt_code", "단지코드"]);
const iName = idx(["kaptname", "kapt_name", "단지명", "아파트명"]);
const iBjd = idx(["bjdcode", "bjd_code", "법정동코드", "loadcode"]);

if (iCode < 0 || iName < 0) {
  console.error("CSV에 kaptCode·kaptName(단지코드·단지명) 열이 필요합니다. header:", lines[0]);
  process.exit(1);
}

let existing = { byAptSeq: {}, byKey: {} };
if (fs.existsSync(outPath)) {
  existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
}

const byKey = { ...existing.byKey };
let added = 0;

for (let li = 1; li < lines.length; li++) {
  const cols = parseCsvLine(lines[li]);
  const code = cols[iCode]?.trim();
  const name = cols[iName]?.trim();
  const bjd = iBjd >= 0 ? cols[iBjd]?.trim().slice(0, 10) : "";
  if (!code || !name) continue;
  const nname = normalizeAptName(name);
  if (bjd.length >= 10) {
    byKey[`${bjd}::${name}`] = code;
    byKey[`${bjd}::${nname}`] = code;
    const lawd = bjd.slice(0, 5);
    byKey[`${lawd}::${name}`] = code;
    byKey[`${lawd}::${nname}`] = code;
  } else {
    byKey[nname] = code;
  }
  added++;
}

const out = { byAptSeq: existing.byAptSeq || {}, byKey };
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
console.log(`Wrote ${outPath} (+${added} rows, ${Object.keys(byKey).length} keys)`);
