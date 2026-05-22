/**
 * K-apt 단지목록·기본정보 API 진단 (node scripts/test-apt-basis.mjs)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildDataGoKrQueryString } from "../lib/data-go-key.mjs";
import { enrichAptBasisBatch } from "../lib/apt-basis.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (k && process.env[k] === undefined) process.env[k] = v;
  }
}

const key = (process.env.DATA_GO_KR_SERVICE_KEY || "").trim();
if (!key) {
  console.error("DATA_GO_KR_SERVICE_KEY 없음 (.env 확인)");
  process.exit(1);
}

{
  const tradeUrl = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";
  const tq = buildDataGoKrQueryString(
    new URLSearchParams({
      LAWD_CD: "11680",
      DEAL_YMD: "202501",
      pageNo: "1",
      numOfRows: "2",
      _type: "json"
    }),
    key
  );
  const tr = await fetch(`${tradeUrl}?${tq}`);
  const td = await tr.json();
  console.log(
    "trade API:",
    tr.status,
    td?.response?.header?.resultCode,
    td?.response?.header?.resultMsg
  );
  const item = td?.response?.body?.items?.item;
  const one = Array.isArray(item) ? item[0] : item;
  if (one) {
    console.log("trade item keys:", Object.keys(one).join(", "));
    console.log("sample item:", JSON.stringify(one));
    const brUrl = "https://apis.data.go.kr/1613000/BldRgstHubService/getBrRecapTitleInfo";
    const brQ = buildDataGoKrQueryString(
      new URLSearchParams({
        sigunguCd: one.sggCd || "11680",
        bjdongCd: "10600",
        platGbCd: "0",
        bun: "0001",
        ji: "0000",
        _type: "json"
      }),
      key
    );
    const br = await fetch(`${brUrl}?${brQ}`);
    const bt = await br.text();
    console.log("building recap:", br.status, bt.slice(0, 200));
  }
}

{
  const devUrl =
    "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";
  const dq = buildDataGoKrQueryString(
    new URLSearchParams({
      LAWD_CD: "11680",
      DEAL_YMD: "202501",
      pageNo: "1",
      numOfRows: "2",
      _type: "json"
    }),
    key
  );
  try {
    const dr = await fetch(`${devUrl}?${dq}`);
    const dd = await dr.json();
    console.log(
      "trade-dev:",
      dr.status,
      dd?.response?.header?.resultCode,
      dd?.response?.header?.resultMsg
    );
  } catch (e) {
    console.log("trade-dev: skip", e.message);
  }
}

const LIST_LEGAL =
  "https://apis.data.go.kr/1613000/AptListServiceV3/getLegaldongAptListV3";
const LIST_SIGUNGU =
  "https://apis.data.go.kr/1613000/AptListServiceV3/getSigunguAptListV3";
const BASIS_URL_V4 =
  "https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4";
const LIST_LEGAL_V4 =
  "https://apis.data.go.kr/1613000/AptListServiceV4/getLegaldongAptListV4";

async function probe(name, url, params) {
  const q = buildDataGoKrQueryString(new URLSearchParams({ ...params, _type: "json" }), key);
  const res = await fetch(`${url}?${q}`);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.log(`\n=== ${name} === HTTP ${res.status} (non-JSON)`);
    console.log(text.slice(0, 400));
    return null;
  }
  const h = data?.response?.header;
  console.log(`\n=== ${name} ===`);
  console.log("resultCode:", h?.resultCode, "msg:", h?.resultMsg);
  const items = data?.response?.body?.items?.item;
  const arr = items ? (Array.isArray(items) ? items : [items]) : [];
  console.log("items:", arr.length);
  if (arr[0]) console.log("sample keys:", Object.keys(arr[0]).slice(0, 12).join(", "));
  if (arr[0]) console.log("sample:", JSON.stringify(arr[0]).slice(0, 280));
  return arr;
}

// 강남구 대치동 예시 bjd 1168010600, lawd 11680
const endpoints = [
  ["Legal V3", LIST_LEGAL, { bjdCode: "1168010600" }],
  ["Legal V2", "https://apis.data.go.kr/1613000/AptListService2/getLegaldongAptList", { bjdCode: "1168010600" }],
  ["Legal V1", "https://apis.data.go.kr/1613000/AptListService1/getLegaldongAptList", { bjdCode: "1168010600" }],
  ["Sigungu V3", LIST_SIGUNGU, { bjdCode: "11680" }],
  ["Sigungu V2", "https://apis.data.go.kr/1613000/AptListService2/getSigunguAptList", { bjdCode: "11680" }],
  ["Basis V4 sample", BASIS_URL_V4, { kaptCode: "A10027875" }],
  ["Legal list V4", LIST_LEGAL_V4, { bjdCode: "1168010600" }],
  ["Basis V1 sample", "https://apis.data.go.kr/1613000/AptBasisInfoService1/getAphusBassInfo", { kaptCode: "A10027875" }],
  ["Basis V2", "https://apis.data.go.kr/1613000/AptBasisInfoService2/getAphusBassInfoV2", { kaptCode: "A10027875" }],
  ["Iden aptSeq", "https://apis.data.go.kr/1613000/AptIdenInfoService1/getAptIdenInfo", { aptSeq: "11680-902" }],
  ["Iden V2", "https://apis.data.go.kr/1613000/AptIdenInfoService2/getAptIdenInfoUse", { aptSeq: "11680-902" }]
];
for (const [name, url, params] of endpoints) {
  await probe(name, url, { ...params, pageNo: "1", numOfRows: "5" });
}

const v4Ops = [
  "getAphusBassInfoV4",
  "getAphusDtlInfoV4",
  "getAphusBassInfoListV4",
  "getAphusBassInfo"
];
for (const op of v4Ops) {
  const url = `https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/${op}`;
  await probe(op, url, { kaptCode: "A10027875", pageNo: "1", numOfRows: "5" });
}
const sigunguV4 = "https://apis.data.go.kr/1613000/AptListServiceV4/getSigunguAptListV4";
for (const params of [
  { bjdCode: "11680" },
  { lawdCd: "11680" },
  { sigunguCode: "11680" },
  { sidoCode: "11", sigunguCode: "680" }
]) {
  await probe("Sigungu V4 " + JSON.stringify(params), sigunguV4, params);
}
await probe(
  "Basis V4 http",
  "http://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4",
  { kaptCode: "A10027875" }
);

for (const params of [
  { kaptCode: "A10027875" },
  { KAPT_CODE: "A10027875" },
  { kaptCode: "A10027875", pageNo: "1", numOfRows: "10" }
]) {
  const q = buildDataGoKrQueryString(
    new URLSearchParams({ ...params, _type: "json" }),
    key
  );
  const r = await fetch(`${BASIS_URL_V4}?${q}`);
  const t = await r.text();
  console.log("\nBasis V4 params", params, "->", r.status, t.slice(0, 150));
}

const batch = await enrichAptBasisBatch(
  [
    {
      lawdCd: "11680",
      dong: "대치동",
      apt: "래미안대치팰리스",
      bjdCode: "1168010600"
    }
  ],
  key
);
console.log("\n=== enrich result ===");
console.log("keys:", Object.keys(batch.byKey || {}));
console.log("hints:", batch.hints);
console.log("errors:", batch.errors?.slice(0, 5));
const first = Object.values(batch.byKey || {})[0];
if (first) console.log("kaptdaCnt:", first.kaptdaCnt, "kaptUsedate:", first.kaptUsedate, "kaptName:", first.kaptName);

if (first?.kaptCode) {
  const basisQ = buildDataGoKrQueryString(
    new URLSearchParams({ kaptCode: first.kaptCode, _type: "json" }),
    key
  );
  const br = await fetch(`${BASIS_URL_V4}?${basisQ}`);
  const bd = await br.json();
  console.log("\n=== basis direct ===", bd?.response?.header?.resultCode, bd?.response?.body?.items?.item?.kaptdaCnt);
}
