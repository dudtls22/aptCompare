import { getKstDateString, getKstYmParam } from "./kst.mjs";
import { getNotifySubscriptionsForCron } from "./notify-sync.mjs";
import { sendKakaoMemo } from "./kakao.mjs";
import { isDealCancelled } from "./deal-status.mjs";
import {
  fetchMonthTrades,
  formatDealLine,
  itemMatchesSubscription
} from "./trade-match.mjs";

function hitKey(h) {
  return `${h.lawdCd}|${h.label}|${h.line}`;
}

export async function runDailyNotify() {
  const todayStr = getKstDateString();
  const ymParam = getKstYmParam();
  const subs = await getNotifySubscriptionsForCron();

  if (!subs.length) {
    return {
      ok: true,
      skipped: true,
      reason: "no_subscriptions",
      today: todayStr,
      hint: "즐겨찾기에서 🔔 알림을 켠 항목이 없습니다."
    };
  }

  const byLawd = new Map();
  for (const sub of subs) {
    const lawdCd = String(sub.lawdCd || "").trim();
    if (!lawdCd) continue;
    if (!byLawd.has(lawdCd)) byLawd.set(lawdCd, []);
    byLawd.get(lawdCd).push(sub);
  }

  const hits = [];
  const seen = new Set();

  for (const [lawdCd, lawdSubs] of byLawd) {
    let items;
    try {
      items = await fetchMonthTrades(lawdCd, ymParam);
    } catch (err) {
      hits.push({
        lawdCd,
        error: err instanceof Error ? err.message : String(err)
      });
      continue;
    }

    for (const sub of lawdSubs) {
      const matched = items.filter(
        (it) => !isDealCancelled(it) && itemMatchesSubscription(it, sub, todayStr)
      );
      if (!matched.length) continue;

      const label = [
        sub.guName || lawdCd,
        sub.dong || "",
        sub.apt || "",
        sub.area ? `${sub.area}㎡` : "전체 평형"
      ]
        .filter(Boolean)
        .join(" · ");

      for (const it of matched) {
        const entry = {
          lawdCd,
          label,
          line: formatDealLine(it),
          apt: sub.apt,
          dong: sub.dong
        };
        const k = hitKey(entry);
        if (seen.has(k)) continue;
        seen.add(k);
        hits.push(entry);
      }
    }
  }

  const dealHits = hits.filter((h) => h.line);
  if (!dealHits.length) {
    return {
      ok: true,
      skipped: true,
      reason: "no_deals_today",
      today: todayStr,
      checkedSubscriptions: subs.length,
      hint: `오늘(${todayStr}) 등록된 신규 실거래가 알림 대상에 없습니다.`
    };
  }

  const lines = dealHits.map((h) => `· ${h.label}\n  ${h.line}`);
  const message = `[아파트 실거래 알림] ${todayStr}\n\n${lines.join("\n\n")}\n\naptCompare`;

  await sendKakaoMemo(message);

  return {
    ok: true,
    sent: true,
    today: todayStr,
    dealCount: dealHits.length,
    checkedSubscriptions: subs.length
  };
}
