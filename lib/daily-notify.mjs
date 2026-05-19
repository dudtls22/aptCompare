import { getKstDateString, getKstYmParam } from "./kst.mjs";
import { getSubscriptions } from "./notify-store.mjs";
import { sendKakaoMemo } from "./kakao.mjs";
import {
  fetchMonthTrades,
  formatDealLine,
  itemMatchesSubscription
} from "./trade-match.mjs";

export async function runDailyNotify() {
  const todayStr = getKstDateString();
  const ymParam = getKstYmParam();
  const subs = (await getSubscriptions()).filter((s) => s && s.notify !== false);

  if (!subs.length) {
    return { ok: true, skipped: true, reason: "no_subscriptions", today: todayStr };
  }

  const byLawd = new Map();
  for (const sub of subs) {
    const lawdCd = String(sub.lawdCd || "").trim();
    if (!lawdCd) continue;
    if (!byLawd.has(lawdCd)) byLawd.set(lawdCd, []);
    byLawd.get(lawdCd).push(sub);
  }

  const hits = [];

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
      const matched = items.filter((it) => itemMatchesSubscription(it, sub, todayStr));
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
        hits.push({
          lawdCd,
          label,
          line: formatDealLine(it),
          apt: sub.apt,
          dong: sub.dong
        });
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
      checkedSubscriptions: subs.length
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
