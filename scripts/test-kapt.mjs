import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { enrichAptBasisBatch } from "../lib/apt-basis.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq <= 0) continue;
  const k = t.slice(0, eq).trim();
  let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (k) process.env[k] = v;
}

const key = process.env.DATA_GO_KR_SERVICE_KEY;
const r = await enrichAptBasisBatch(
  [{ lawdCd: "11680", dong: "대치동", apt: "래미안대치팰리스", bjdCode: "1168010600" }],
  key
);
console.log("byKey count:", Object.keys(r.byKey).length);
console.log("hints:", r.hints);
console.log("errors:", r.errors);
const b = Object.values(r.byKey)[0];
if (b) console.log("kaptdaCnt:", b.kaptdaCnt, "kaptUsedate:", b.kaptUsedate, "name:", b.kaptName);
