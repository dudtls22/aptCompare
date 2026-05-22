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
  const k = t.slice(0, eq).trim();
  let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (k) process.env[k] = v;
}
const key = process.env.DATA_GO_KR_SERVICE_KEY;

for (const [label, extra] of [
  ["aptSeq", { aptSeq: "11680-214" }],
  ["kaptSeq", { kaptSeq: "11680-214" }],
  ["bjd+name", { bjdCode: "1168010600", kaptName: "쌍용대치2" }]
]) {
  const q = buildDataGoKrQueryString(new URLSearchParams({ ...extra, _type: "json" }), key);
  const r = await fetch(
    `https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4?${q}`
  );
  const d = await r.json();
  const item = d?.response?.body?.item;
  console.log("basis extra", label, item?.kaptdaCnt, item?.kaptCode, item?.kaptName);
}

for (const kaptCode of ["11680-214", "A11680214", "11680214"]) {
  const q = buildDataGoKrQueryString(
    new URLSearchParams({ kaptCode, _type: "json" }),
    key
  );
  const r = await fetch(
    `https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4?${q}`
  );
  const d = await r.json();
  const item = d?.response?.body?.item;
  console.log("basis aptSeq as code", kaptCode, item?.kaptdaCnt, item?.kaptName);
}

const probes = [
  ["Basis V4", "https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4", { kaptCode: "A10027875" }]
];

{
  const q = buildDataGoKrQueryString(
    new URLSearchParams({ kaptCode: "A10027875", _type: "json" }),
    key
  );
  const r = await fetch(
    `https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4?${q}`
  );
  console.log("\n=== full basis sample ===\n", (await r.text()).slice(0, 800));
}

const probes2 = [
  ["List legal V4", "https://apis.data.go.kr/1613000/AptListServiceV4/getLegaldongAptListV4", { bjdCode: "1168010600", pageNo: "1", numOfRows: "5" }],
  ["List sigungu V4", "https://apis.data.go.kr/1613000/AptListServiceV4/getSigunguAptListV4", { bjdCode: "11680", pageNo: "1", numOfRows: "5" }],
  ["List sido V4", "https://apis.data.go.kr/1613000/AptListServiceV4/getSidoAptListV4", { sidoCode: "11", pageNo: "1", numOfRows: "5" }],
  ["List name V4", "https://apis.data.go.kr/1613000/AptListServiceV4/getAptListByAptNameV4", { aptName: "래미안", pageNo: "1", numOfRows: "5" }],
  ["Basis kaptName", "https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4", { kaptName: "래미안대치팰리스" }],
  ["Iden aptSeq", "https://apis.data.go.kr/1613000/AptIdenInfoService1/getAptIdenInfo", { aptSeq: "11680-380" }],
  ["Iden2", "https://apis.data.go.kr/1613000/AptIdenInfoService2/getAptIdenInfoUse", { aptSeq: "11680-380" }],
  ["List2 legal", "https://apis.data.go.kr/1613000/AptListService2/getLegaldongAptList", { bjdCode: "1168010600", pageNo: "1", numOfRows: "10" }],
  ["List5", "https://apis.data.go.kr/1613000/AptListService/getLegaldongAptList", { bjdCode: "1168010600", pageNo: "1", numOfRows: "10" }]
];

for (const [name, url, params] of probes) {
  try {
    const q = buildDataGoKrQueryString(new URLSearchParams({ ...params, _type: "json" }), key);
    const r = await fetch(`${url}?${q}`);
    const t = await r.text();
    let info = `${r.status}`;
    try {
      const d = JSON.parse(t);
      info += ` ${d?.response?.header?.resultCode} ${d?.response?.header?.resultMsg}`;
      const item = d?.response?.body?.items?.item;
      const arr = item ? (Array.isArray(item) ? item : [item]) : [];
      if (arr[0]) info += ` n=${arr.length} keys=${Object.keys(arr[0]).slice(0,6).join(",")}`;
    } catch {
      info += ` ${t.slice(0, 60)}`;
    }
    if (name.startsWith("List") && r.status >= 400) {
      console.log(name, "body:", t.slice(0, 200));
    }
    console.log(name, "->", info);
  } catch (e) {
    console.log(name, "->", e.message);
  }
}
