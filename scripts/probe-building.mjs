import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildDataGoKrQueryString } from "../lib/data-go-key.mjs";

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

async function probe(name, url, params) {
  const q = buildDataGoKrQueryString(
    new URLSearchParams({ pageNo: "1", numOfRows: "5", _type: "json", ...params }),
    key
  );
  const r = await fetch(`${url}?${q}`, { headers: { Referer: "https://www.data.go.kr/" } });
  const t = await r.text();
  console.log("\n===", name, "===", r.status);
  console.log(t.slice(0, 500));
}

// 미성2차 압구정동 trade-dev sample
await probe(
  "BrRecapTitle",
  "https://apis.data.go.kr/1613000/BldRgstHubService/getBrRecapTitleInfo",
  {
    sigunguCd: "11680",
    bjdongCd: "11000",
    platGbCd: "0",
    bun: "0397",
    ji: "0000"
  }
);
await probe(
  "BrTitle",
  "https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo",
  {
    sigunguCd: "11680",
    bjdongCd: "11000",
    platGbCd: "0",
    bun: "0397",
    ji: "0000"
  }
);
// 래미안대치팰리스 대치동 - need bonbun from trade
const q2 = buildDataGoKrQueryString(
  new URLSearchParams({
    LAWD_CD: "11680",
    DEAL_YMD: "202501",
    pageNo: "1",
    numOfRows: "200",
    _type: "json"
  }),
  key
);
const dr = await fetch(
  `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?${q2}`
);
const dd = await dr.json();
const items = dd?.response?.body?.items?.item;
const arr = items ? (Array.isArray(items) ? items : [items]) : [];
const hit = arr.find((x) => String(x.aptNm || "").includes("래미안대치"));
console.log("\ntrade hit", hit?.aptNm, hit?.bonbun, hit?.bubun, hit?.umdCd);
if (hit) {
  const umd = String(hit.umdCd).padStart(5, "0");
  await probe("BrRecap 래미안", "https://apis.data.go.kr/1613000/BldRgstHubService/getBrRecapTitleInfo", {
    sigunguCd: String(hit.sggCd).slice(0, 5),
    bjdongCd: umd,
    platGbCd: "0",
    bun: String(hit.bonbun || "").padStart(4, "0"),
    ji: String(hit.bubun || "0000").padStart(4, "0")
  });
}
