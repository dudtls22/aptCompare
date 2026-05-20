/**
 * 공공데이터 serviceKey: 인코딩 키(% 포함)는 그대로, 디코딩 키는 URLSearchParams로 1회만 인코딩.
 */
export function buildDataGoKrQueryString(searchParams, serviceKey) {
  const params = new URLSearchParams(searchParams);
  const key = String(serviceKey || "").trim();
  const rest = params.toString();
  const isPercentEncoded = /%[0-9A-Fa-f]{2}/.test(key);
  if (isPercentEncoded) {
    return rest ? `serviceKey=${key}&${rest}` : `serviceKey=${key}`;
  }
  params.set("serviceKey", key);
  return params.toString();
}
