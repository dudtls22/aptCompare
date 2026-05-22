/**
 * 건축물대장·아파트기본정보 세대수 진단
 * node scripts/test-building.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { enrichAptBasisBatch } from "../lib/apt-basis.mjs";
import { fetchHouseholdFromBuildingRegistry } from "../lib/building-registry.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq <= 0) continue;
  let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  process.env[t.slice(0, eq).trim()] = v;
}

const key = process.env.DATA_GO_KR_SERVICE_KEY;

const parcel = {
  sigunguCd: "11680",
  bjdongCd: "10600",
  platGbCd: "0",
  bun: "1027",
  ji: "0000"
};

console.log("=== 건축물대장 (래미안대치팰리스 지번) ===");
const br = await fetchHouseholdFromBuildingRegistry(parcel, key);
console.log("row:", br.row);
console.log("errors:", br.errors?.slice(0, 3));

console.log("\n=== enrich (kapt + 건축물대장) ===");
const batch = await enrichAptBasisBatch(
  [
    {
      lawdCd: "11680",
      dong: "대치동",
      apt: "래미안대치팰리스",
      bjdCode: "1168010600",
      aptSeq: "11680-4394",
      kaptCode: "A10027800",
      parcel
    }
  ],
  key
);
const row = Object.values(batch.byKey)[0];
console.log("hh:", row?.totHhldCnt ?? row?.kaptdaCnt ?? row?.hhldCnt, "source:", row?._source);
console.log("hints:", batch.hints);
console.log("errors:", batch.errors?.slice(0, 3));
