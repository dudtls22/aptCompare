import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildDataGoKrQueryString } from "../lib/data-go-key.mjs";
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

const q = buildDataGoKrQueryString(
  new URLSearchParams({
    LAWD_CD: "11680",
    DEAL_YMD: "202501",
    pageNo: "1",
    numOfRows: "500",
    _type: "json"
  }),
  key
);
const r = await fetch(
  `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?${q}`
);
const j = await r.json();
const items = j?.response?.body?.items?.item;
const arr = items ? (Array.isArray(items) ? items : [items]) : [];
const hits = arr.filter((x) => String(x.aptNm || "").includes("힐스테이트") && String(x.umdNm || "").includes("삼성"));
console.log("trade hits:", hits.length);
for (const h of hits.slice(0, 3)) {
  console.log(JSON.stringify(h, null, 2));
}

if (hits[0]) {
  const h = hits[0];
  const parcel = {
    sigunguCd: String(h.sggCd).slice(0, 5),
    bjdongCd: String(h.umdCd).padStart(5, "0").slice(0, 5),
    platGbCd: "0",
    bun: String(h.bonbun).replace(/\D/g, "").padStart(4, "0").slice(-4),
    ji: String(h.bubun || "0").replace(/\D/g, "").padStart(4, "0").slice(-4)
  };
  console.log("\nparcel", parcel);
  const br = await fetchHouseholdFromBuildingRegistry(parcel, key);
  console.log("building hh:", br.row?.hhldCnt, br.errors?.[0]);

  const batch = await enrichAptBasisBatch(
    [
      {
        lawdCd: "11680",
        dong: "삼성동",
        apt: h.aptNm,
        bjdCode: `${String(h.sggCd).slice(0, 5)}${String(h.umdCd).padStart(5, "0")}`.slice(0, 10),
        aptSeq: h.aptSeq,
        parcel
      }
    ],
    key
  );
  const row = Object.values(batch.byKey)[0];
  console.log("enrich:", row?.kaptdaCnt, row?.totHhldCnt, row?.hhldCnt, row?.kaptName, row?._source);
  console.log("errors:", batch.errors);
}
