/**
 * 시군구(LAWD)별 동 목록 — 서울 고정 목록 + 실거래 API 병합 (1·2번 화면 공통)
 */
(function (global) {
  const SEOUL_DONGS_BY_GU = {
    "11110": [
      "청운동", "신교동", "궁정동", "효자동", "삼청동", "부암동", "평창동", "무악동", "사직동", "창신동",
      "숭인동", "이화동", "혜화동", "명륜동", "와룡동", "무악동", "교남동", "인사동"
    ],
    "11140": [
      "소공동", "회현동", "명동", "필동", "장충동", "광희동", "을지로동", "신당동", "다산동", "약수동",
      "충무로동", "인현동", "남대문로", "황학동", "묵정동", "을지로", "정동", "봉래동", "남창동"
    ],
    "11170": [
      "후암동", "용산동", "남영동", "청파동", "원효로동", "효창동", "용문동", "이촌동", "이태원동", "한남동",
      "동빙고동", "서빙고동", "문배동", "신계동", "삼각지", "보광동"
    ],
    "11200": [
      "왕십리동", "마장동", "사근동", "행당동", "응봉동", "금호동", "옥수동", "성수동", "송정동", "용답동",
      "성수동1가", "성수동2가", "송정동", "금호동1가", "금호동2가", "금호동3가", "금호동4가"
    ],
    "11215": ["중곡동", "능동", "구의동", "광장동", "자양동", "화양동", "군자동", "자양동", "구의동"],
    "11230": ["용신동", "제기동", "청량리동", "회기동", "휘경동", "이문동", "장안동", "전농동", "답십리동"],
    "11260": ["면목동", "상봉동", "중화동", "묵동", "망우동", "신내동", "망우본동", "신내동"],
    "11290": [
      "성북동", "삼선동", "동선동", "돈암동", "안암동", "보문동", "정릉동", "길음동", "종암동", "장위동",
      "석관동", "하월곡동", "상월곡동"
    ],
    "11305": ["삼양동", "미아동", "송중동", "송천동", "삼각산동", "번동", "수유동", "우이동", "인수동"],
    "11320": ["쌍문동", "방학동", "창동", "도봉동", "방학동", "창동"],
    "11350": ["월계동", "공릉동", "하계동", "중계동", "상계동", "녹천동"],
    "11380": [
      "녹번동", "불광동", "갈현동", "구산동", "대조동", "응암동", "역촌동", "신사동", "증산동", "수색동",
      "진관동"
    ],
    "11410": [
      "충현동", "천연동", "북아현동", "신촌동", "연희동", "홍제동", "홍은동", "남가좌동", "북가좌동", "냉천동"
    ],
    "11440": [
      "아현동", "공덕동", "도화동", "용강동", "대흥동", "염리동", "신수동", "서강동", "서교동", "합정동",
      "망원동", "연남동", "성산동", "상암동"
    ],
    "11470": ["목동", "신월동", "신정동", "목1동", "목2동", "목3동", "목4동", "목5동"],
    "11500": [
      "염창동", "등촌동", "화곡동", "우장산동", "가양동", "발산동", "공항동", "방화동", "마곡동", "내발산동"
    ],
    "11530": ["신도림동", "구로동", "가리봉동", "고척동", "개봉동", "오류동", "천왕동", "항동", "궁동"],
    "11545": ["가산동", "독산동", "시흥동", "범일동"],
    "11560": [
      "영등포동", "여의동", "당산동", "도림동", "문래동", "양평동", "신길동", "대림동", "당산동1가", "당산동2가"
    ],
    "11590": ["노량진동", "상도동", "흑석동", "사당동", "대방동", "신대방동", "동작동", "본동"],
    "11620": ["봉천동", "신림동", "남현동", "신사동", "조원동", "대학동"],
    "11650": [
      "서초동", "잠원동", "반포동", "방배동", "양재동", "내곡동", "염곡동", "우면동", "원지동", "신원동"
    ],
    "11680": [
      "역삼동", "개포동", "청담동", "삼성동", "대치동", "신사동", "논현동", "압구정동", "세곡동", "자곡동",
      "도곡동", "일원동", "수서동"
    ],
    "11710": [
      "잠실동", "신천동", "풍납동", "송파동", "석촌동", "삼전동", "가락동", "문정동", "장지동", "위례동",
      "방이동", "오금동", "거여동", "마천동"
    ],
    "11740": [
      "강일동", "상일동", "명일동", "고덕동", "암사동", "천호동", "성내동", "길동", "둔촌동", "굽은동"
    ]
  };

  const LAWD_PREFIX_ALT = [
    ["51", "42"],
    ["52", "45"]
  ];

  function normalizeDongName(name) {
    return String(name || "").replaceAll(" ", "").trim();
  }

  function dongCoreName(name) {
    const n = normalizeDongName(name);
    if (!n) return "";
    if (n.endsWith("동")) return n.slice(0, -1);
    if (n.endsWith("가")) return n.slice(0, -1);
    return n;
  }

  /** API·주소 문자열에서 법정동 라벨 추출 (예: 서울특별시중구회현동 → 회현동) */
  function extractDongLabel(raw) {
    const n = normalizeDongName(raw);
    if (!n) return "";
    const matches = n.match(/[가-힣][가-힣0-9]*(?:동|가)/g);
    if (matches && matches.length) return matches[matches.length - 1];
    return n;
  }

  function isSameDong(itemDong, selectedDong) {
    const a = extractDongLabel(itemDong);
    const b = extractDongLabel(selectedDong);
    if (!a || !b) return false;
    if (a === b) return true;
    const ac = dongCoreName(a);
    const bc = dongCoreName(b);
    return Boolean(ac) && ac === bc;
  }

  function lawdApiCodesForQuery(lawdCd) {
    const c = String(lawdCd || "").trim();
    if (!c || c.length !== 5) return c ? [c] : [];
    const out = [c];
    for (const [nw, old] of LAWD_PREFIX_ALT) {
      if (c.startsWith(nw)) out.push(old + c.slice(2));
      if (c.startsWith(old)) out.push(nw + c.slice(2));
    }
    return [...new Set(out)];
  }

  function getStaticDongList(lawdCd) {
    const list = SEOUL_DONGS_BY_GU[String(lawdCd || "").trim()];
    return Array.isArray(list) ? [...list] : [];
  }

  function getTradeDongRaw(item) {
    return String(
      item?.umdNm ?? item?.UMD_NM ?? item?.umd_nm ?? item?.dong ?? item?.DONG ?? item?.법정동 ?? ""
    ).trim();
  }

  function collectDongsFromTradeItems(items) {
    const set = new Set();
    for (const item of items || []) {
      const label = extractDongLabel(getTradeDongRaw(item));
      if (label) set.add(label);
    }
    return [...set];
  }

  function mergeDongLists(...lists) {
    const set = new Set();
    for (const list of lists) {
      for (const d of list || []) {
        const label = extractDongLabel(d);
        if (label) set.add(label);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ko"));
  }

  global.RegionDong = {
    SEOUL_DONGS_BY_GU,
    extractDongLabel,
    isSameDong,
    dongCoreName,
    normalizeDongName,
    lawdApiCodesForQuery,
    getStaticDongList,
    getTradeDongRaw,
    collectDongsFromTradeItems,
    mergeDongLists
  };
})(typeof window !== "undefined" ? window : globalThis);
