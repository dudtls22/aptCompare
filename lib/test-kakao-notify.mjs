import { getKstParts, getKstYmParam } from "./kst.mjs";
import { sendKakaoMemo } from "./kakao.mjs";
import {
  fetchMonthTrades,
  formatDealLine,
  getAptName,
  getAreaFloorValue,
  getDongName,
  itemDealDateString
} from "./trade-match.mjs";

function buildRecentYmParams(count = 3) {
  const p = getKstParts();
  let y = Number.parseInt(p.year, 10);
  let m = Number.parseInt(p.month, 10);
  const list = [];
  for (let i = 0; i < count; i += 1) {
    list.push(`${y}${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }
  return list;
}

export async function findLatestTradeItem(lawdCd) {
  const code = String(lawdCd || "11680").trim();
  const months = buildRecentYmParams(4);
  const all = [];

  for (const ymParam of months) {
    const items = await fetchMonthTrades(code, ymParam);
    all.push(...items);
  }

  if (!all.length) {
    return null;
  }

  all.sort((a, b) => {
    const db = itemDealDateString(b);
    const da = itemDealDateString(a);
    if (db !== da) return db.localeCompare(da);
    const amtB = Number(String(b?.dealAmount ?? "").replaceAll(",", ""));
    const amtA = Number(String(a?.dealAmount ?? "").replaceAll(",", ""));
    return (Number.isFinite(amtB) ? amtB : 0) - (Number.isFinite(amtA) ? amtA : 0);
  });

  return { lawdCd: code, item: all[0], searchedMonths: months };
}

export function formatLatestTradeMessage({ lawdCd, item }) {
  const date = itemDealDateString(item);
  const dong = getDongName(item);
  const apt = getAptName(item);
  const area = getAreaFloorValue(item);
  const label = [dong, apt, area != null ? `${area}㎡` : ""].filter(Boolean).join(" · ");
  const line = formatDealLine(item);

  return {
    message: `[아파트 실거래 테스트] ${date}\n\n· ${label} (${lawdCd})\n  ${line}\n\naptCompare — API 최신 1건 테스트 발송`,
    preview: { date, dong, apt, area, lawdCd, line }
  };
}

/** 카카오톡으로 API 최신 실거래 1건 테스트 발송 */
export async function sendTestKakaoLatestTrade(options = {}) {
  const lawdCd = String(options.lawdCd || "11680").trim();
  const found = await findLatestTradeItem(lawdCd);
  if (!found?.item) {
    throw new Error(
      `최근 실거래를 찾지 못했습니다. (lawdCd=${lawdCd}, 조회월=${buildRecentYmParams(4).join(",")})`
    );
  }

  const { message, preview } = formatLatestTradeMessage(found);
  await sendKakaoMemo(message);

  return {
    ok: true,
    sent: true,
    lawdCd: found.lawdCd,
    searchedMonths: found.searchedMonths,
    currentYm: getKstYmParam(),
    preview,
    message
  };
}
