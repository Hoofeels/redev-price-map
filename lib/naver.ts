/**
 * 네이버부동산 매물(호가) 파싱 — 순수 함수(네트워크 X, 테스트 대상).
 * 수집은 scripts/scrapeNaver.ts가 Playwright 실브라우저 세션으로 수행한다
 * (서버 직접 fetch는 429 anti-bot). ⚠️ ToS상 로컬 전용 best-effort, 공개 재배포 금지.
 */

export type NaverTradeType = "매매" | "전세" | "월세" | "단기임대" | string;

/** 구역에 붙는 호가 매물 1건 (실거래 Transaction과 별도, source="네이버 호가"). */
export interface NaverArticle {
  tradeType: NaverTradeType;
  /** 호가(만원). 월세는 보증금 기준. */
  priceManwon: number;
  /** 원문 호가 문자열 ("33억", "12억 5,000", "8,500"). */
  priceText: string;
  /** 면적 표기(공급/타입, 예 "201A", "84"). */
  areaName: string | null;
  /** 층 정보(예 "중/22", "고/15"). */
  floorInfo: string | null;
  /** 매물 확인일 YYYYMMDD. */
  confirmYmd: string | null;
}

/**
 * 네이버 호가 문자열 → 만원 단위 정수.
 * "33억"→330000, "12억 5,000"→125000, "8,500"→8500, "1억"→10000.
 * 월세 "1,000/50"(보증/월) → 보증금(1000)만 취함.
 */
export function parsePriceToManwon(s: string): number {
  const head = s.replace(/\s/g, "").split("/")[0]; // 월세 보증금만
  const m = head.match(/^(?:(\d+)억)?([\d,]+)?$/);
  if (!m || (!m[1] && !m[2])) return 0;
  const eok = m[1] ? Number(m[1]) : 0;
  const man = m[2] ? Number(m[2].replace(/,/g, "")) : 0;
  return eok * 10000 + man;
}

/** 네이버 article 원시 객체 → NaverArticle (호가 없으면 null). */
export function parseNaverArticle(raw: Record<string, unknown>): NaverArticle | null {
  const priceText = String(raw.dealOrWarrantPrc ?? "").trim();
  if (!priceText) return null;
  return {
    tradeType: String(raw.tradeTypeName ?? "").trim() || "기타",
    priceText,
    priceManwon: parsePriceToManwon(priceText),
    areaName: raw.areaName != null ? String(raw.areaName) : null,
    floorInfo: raw.floorInfo != null ? String(raw.floorInfo) : null,
    confirmYmd: raw.articleConfirmYmd != null ? String(raw.articleConfirmYmd) : null,
  };
}

/** article 목록 파싱 + 매매/전세만 추림(월세 제외 옵션). */
export function parseNaverArticles(
  list: Array<Record<string, unknown>>,
  opts: { saleAndJeonseOnly?: boolean } = {},
): NaverArticle[] {
  const out = list.map(parseNaverArticle).filter((a): a is NaverArticle => a !== null);
  if (opts.saleAndJeonseOnly) {
    return out.filter((a) => a.tradeType === "매매" || a.tradeType === "전세");
  }
  return out;
}
