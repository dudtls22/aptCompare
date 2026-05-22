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
const q = buildDataGoKrQueryString(
  new URLSearchParams({
    LAWD_CD: "11680",
    DEAL_YMD: "202501",
    pageNo: "1",
    numOfRows: "5",
    _type: "json"
  }),
  key
);
const r = await fetch(
  `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?${q}`
);
const j = await r.json();
const it = j.response.body.items.item;
const one = Array.isArray(it) ? it[0] : it;
console.log(JSON.stringify(one, null, 2));
