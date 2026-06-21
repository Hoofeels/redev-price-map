import type { RedevelopmentZone, Transaction } from "./types";

function normalize(s: string): string {
  return s.replace(/\s+/g, "");
}

/** 주소 문자열에서 법정동(…동/…읍/…면/…가) 키워드 추출. */
export function extractDong(address: string): string | null {
  const m = address.match(/([가-힣]+(?:동|읍|면|가))/g);
  return m && m.length > 0 ? m[m.length - 1] : null;
}

/**
 * 대표 단지/주소 기준 매칭 (스펙 결정사항: Round 7).
 * - 재건축 등 대표 단지가 있으면: 거래의 단지명이 대표 단지명을 포함하면 채택.
 * - 대표 단지가 없으면(재개발): 대표 주소의 법정동 키워드로 매칭.
 */
export function matchTradesToZone(
  zone: RedevelopmentZone,
  trades: Transaction[],
): Transaction[] {
  if (zone.representativeComplex) {
    const key = normalize(zone.representativeComplex);
    return trades.filter(
      (t) => t.complexName != null && normalize(t.complexName).includes(key),
    );
  }
  const dong = zone.representativeAddress ? extractDong(zone.representativeAddress) : null;
  if (!dong) return [];
  const key = normalize(dong);
  // 재개발: 거래의 법정동(dong)으로 매칭. dong 없으면 단지명 폴백.
  return trades.filter((t) => {
    if (t.dong != null && normalize(t.dong).includes(key)) return true;
    return t.complexName != null && normalize(t.complexName).includes(key);
  });
}
