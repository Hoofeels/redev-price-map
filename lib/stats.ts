import type { RedevelopmentZone, Transaction } from "./types";

export interface ZoneStats {
  count: number;
  /** 평균 거래금액(만원) */
  avgPriceManwon: number | null;
  /** ㎡당 평균 단가(만원/㎡) */
  avgPricePerM2: number | null;
  /** 최근 가격 추이 */
  recentTrend: "상승" | "하락" | "보합" | "데이터부족";
  /** 최근 거래일 */
  latestDate: string | null;
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * 거래 목록으로부터 요약 통계 계산.
 * 추이: 거래를 날짜순 정렬 후 전반부/후반부 ㎡당 단가 평균을 비교.
 */
export function computeZoneStats(transactions: Transaction[]): ZoneStats {
  const count = transactions.length;
  if (count === 0) {
    return {
      count: 0,
      avgPriceManwon: null,
      avgPricePerM2: null,
      recentTrend: "데이터부족",
      latestDate: null,
    };
  }

  const avgPriceManwon = mean(transactions.map((t) => t.priceManwon));
  const perM2 = transactions
    .filter((t) => t.areaM2 > 0)
    .map((t) => t.priceManwon / t.areaM2);
  const avgPricePerM2 = mean(perM2);

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const latestDate = sorted[sorted.length - 1].date;

  let recentTrend: ZoneStats["recentTrend"] = "데이터부족";
  if (sorted.length >= 4) {
    const half = Math.floor(sorted.length / 2);
    const earlier = mean(
      sorted.slice(0, half).filter((t) => t.areaM2 > 0).map((t) => t.priceManwon / t.areaM2),
    );
    const later = mean(
      sorted.slice(half).filter((t) => t.areaM2 > 0).map((t) => t.priceManwon / t.areaM2),
    );
    if (earlier != null && later != null) {
      const change = (later - earlier) / earlier;
      if (change > 0.03) recentTrend = "상승";
      else if (change < -0.03) recentTrend = "하락";
      else recentTrend = "보합";
    }
  }

  return { count, avgPriceManwon, avgPricePerM2, recentTrend, latestDate };
}

export function formatManwon(manwon: number | null): string {
  if (manwon == null) return "-";
  if (manwon >= 10000) {
    const eok = Math.floor(manwon / 10000);
    const rest = Math.round(manwon % 10000);
    return rest > 0 ? `${eok}억 ${rest.toLocaleString()}만` : `${eok}억`;
  }
  return `${Math.round(manwon).toLocaleString()}만`;
}

export function zoneStats(zone: RedevelopmentZone): ZoneStats {
  return computeZoneStats(zone.transactions);
}
