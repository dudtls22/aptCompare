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

const params = {
  sigunguCd: "11680",
  bjdongCd: "10600",
  platGbCd: "0",
  bun: "1027",
  ji: "0000",
  pageNo: "1",
  numOfRows: "5"
};

const urls = [
  ["Hub Recap", "https://apis.data.go.kr/1613000/BldRgstHubService/getBrRecapTitleInfo"],
  ["Hub Title", "https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo"],
  ["Hub V2 Recap", "https://apis.data.go.kr/1613000/BldRgstHubServiceV2/getBrRecapTitleInfo"],
  ["BldRgst Recap", "https://apis.data.go.kr/1613000/BldRgstService/getBrRecapTitleInfo"],
  ["1611 Hub", "http://apis.data.go.kr/1611000/BldRgstHubService/getBrRecapTitleInfo"]
];

for (const [name, url] of urls) {
  const q = buildDataGoKrQueryString(new URLSearchParams({ ...params, _type: "json" }), key);
  try {
    const r = await fetch(`${url}?${q}`, { headers: { Referer: "https://www.data.go.kr/" } });
    const t = await r.text();
    let extra = "";
    try {
      const d = JSON.parse(t);
      extra = ` ${d?.response?.header?.resultCode} ${d?.response?.header?.resultMsg}`;
      const item = d?.response?.body?.item ?? d?.response?.body?.items?.item;
      const one = Array.isArray(item) ? item[0] : item;
      if (one?.hhldCnt) extra += ` hhldCnt=${one.hhldCnt}`;
    } catch {
      extra = ` ${t.slice(0, 60)}`;
    }
    console.log(name, r.status, extra);
  } catch (e) {
    console.log(name, "ERR", e.message);
  }
}
