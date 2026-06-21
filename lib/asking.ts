import type { NaverArticle } from "./naver";
import askingRaw from "@/data/naver-asking.json";

/**
 * 네이버부동산 호가(참고) — scripts/scrapeNaver.ts 산출물(data/naver-asking.json) 로드.
 * ⚠️ 로컬 전용 참고 데이터. 네이버 ToS상 공개 사이트 재호스팅 금지(이 import는 로컬 빌드 가정).
 */
export interface ZoneAsking {
  zoneId: string;
  complexNo: string | null;
  complexName: string | null;
  asOf: string;
  articles: NaverArticle[];
}

const byZone = new Map<string, ZoneAsking>(
  (askingRaw as unknown as ZoneAsking[]).map((a) => [a.zoneId, a]),
);

/** 구역의 호가 데이터(매물 1건 이상일 때만). 없으면 null. */
export function getAsking(zoneId: string): ZoneAsking | null {
  const a = byZone.get(zoneId);
  return a && a.articles.length > 0 ? a : null;
}
