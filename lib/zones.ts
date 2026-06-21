import seoulData from "@/data/seoul-zones.json";
import gyeonggiData from "@/data/gyeonggi-zones.json";
import boundaryData from "@/data/zone-boundaries.json";
import { MOCK_ZONES } from "./mockData";
import type { RedevelopmentZone, ZoneFilter } from "./types";

const seoulZones = seoulData as unknown as RedevelopmentZone[];
const gyeonggiZones = gyeonggiData as unknown as RedevelopmentZone[];

/**
 * 경계 폴리곤(scripts/scrapeBoundaries.ts 산출물, zoneId → [lat,lng][]).
 * 서울 열린데이터광장 정비구역 경계(공공누리 4유형) 기반 → 로컬 전용, 공개 재배포 금지.
 */
const boundaries = boundaryData as unknown as Record<string, [number, number][]>;
const realZones = [...seoulZones, ...gyeonggiZones].map((z) =>
  boundaries[z.id] ? { ...z, boundary: boundaries[z.id] } : z,
);

/**
 * 정비구역 데이터 소스 = 서울(정보몽땅) + 경기(경기데이터드림) 실데이터.
 * 둘 다 비면 샘플(mock). 스크래핑: `npm run scrape:seoul` / `scrape:gyeonggi`.
 */
export function getAllZones(): RedevelopmentZone[] {
  return realZones.length > 0 ? realZones : MOCK_ZONES;
}

export function isUsingRealData(): boolean {
  return realZones.length > 0;
}

export function filterZones(
  zones: RedevelopmentZone[],
  filter: ZoneFilter,
): RedevelopmentZone[] {
  const q = filter.query.trim();
  return zones.filter((z) => {
    if (filter.sido !== "전체" && z.sido !== filter.sido) return false;
    if (filter.projectType !== "전체" && z.projectType !== filter.projectType) return false;
    if (filter.stage !== "전체" && z.stage !== filter.stage) return false;
    if (q && !`${z.name} ${z.sigungu} ${z.representativeAddress}`.includes(q)) return false;
    return true;
  });
}
