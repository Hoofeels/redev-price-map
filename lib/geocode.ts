import { extractDong } from "./match";

/**
 * VWorld 지오코딩 (국토부, api.vworld.kr) — 한국 지번/도로명 주소 → WGS84 위경도.
 * 엔드포인트: /req/address?service=address&request=getcoord&version=2.0&crs=epsg:4326
 *   &type=PARCEL|ROAD&address=...&format=json&key=...
 * 응답: { response: { status:"OK", result:{ point:{ x:lng, y:lat } } } }
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** 지오코딩용 주소 정규화: 시도명 보정, 괄호·번지·일원 등 잡음 제거. */
export function cleanAddressForGeocode(address: string): string {
  let a = address;
  a = a.replace(/^서울\s/, "서울특별시 ").replace(/^경기\s/, "경기도 ");
  a = a.replace(/\([^)]*\)/g, " "); // (제일복지회관 주변) 등 제거
  a = a.replace(/번지/g, " ").replace(/일원/g, " ").replace(/일대/g, " ");
  a = a.replace(/\s+/g, " ").trim();
  return a;
}

/**
 * 정밀 지번 지오코딩이 불가한 구역(정보몽땅 대표지번 부정확, 또는 "블럭·롯트" 표기)의
 * 마커 근사용 동 중심 좌표. 구-center보다 정확하지만 정밀 좌표는 아니므로 geocoded=false 유지.
 * 바-동(동만) 지오코딩은 구 밖으로 튀는 사례가 있어, 검증된 동 중심을 직접 등록한다. 필요 시 확장.
 */
export const SEOUL_DONG_CENTROID: Record<string, LatLng> = {
  공릉동: { lat: 37.6256, lng: 127.0718 }, // 노원구
  상계동: { lat: 37.66, lng: 127.065 }, // 노원구
};

/**
 * 정보몽땅 대표지번이 부정확/오류라 지오코딩이 틀리는 구역의 검증된 좌표 override(SHP centroid).
 * zone.name 부분일치로 적용 — 인덱스 기반 zoneId는 재수집 시 바뀌므로 이름으로 매칭.
 */
export const ZONE_COORD_OVERRIDE: Array<LatLng & { match: string }> = [
  { match: "상계1재정비촉진", lat: 37.67352, lng: 127.08281 }, // 상계1구역=자력6구역
  { match: "상계2재정비촉진", lat: 37.6718, lng: 127.07937 }, // 상계2재정비촉진구역 (Kakao ~1km 오차)
  { match: "상계동 154-3", lat: 37.66391, lng: 127.07078 }, // 주소필드 '공릉동' 오기
];

/**
 * 주소의 법정동을 동 중심 테이블에서 찾아, 구역 id 기반 결정적 지터를 더해 반환.
 * 같은 동의 여러 구역이 한 점에 겹치지 않도록 ±~0.003° 분산. 미등록 동이면 null.
 */
export function approxDongCentroid(address: string, seed: string): LatLng | null {
  const dong = extractDong(address);
  const c = dong ? SEOUL_DONG_CENTROID[dong] : undefined;
  if (!c) return null;
  // FNV-1a로 시드 해시 후 splitmix32 파이널라이저로 전비트 아발란치.
  // (FNV의 마지막 곱셈만으로는 끝글자 차이가 상위비트로 안 퍼져 dy/dx가 붙는다)
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const mix = (x: number): number => {
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    x ^= x >>> 16;
    return x >>> 0;
  };
  const h1 = mix(h);
  const h2 = mix(h ^ 0x9e3779b9);
  const dy = (h1 / 4294967296 - 0.5) * 0.008; // ±~0.004° (~400m)
  const dx = (h2 / 4294967296 - 0.5) * 0.008;
  return { lat: c.lat + dy, lng: c.lng + dx };
}

const VWORLD_ENDPOINT = "https://api.vworld.kr/req/address";

export async function geocodeVworld(
  key: string,
  address: string,
  type: "PARCEL" | "ROAD" = "PARCEL",
): Promise<LatLng | null> {
  const params = new URLSearchParams({
    service: "address",
    request: "getcoord",
    version: "2.0",
    crs: "epsg:4326",
    address,
    format: "json",
    type,
    key,
  });
  let res: Response;
  try {
    res = await fetch(`${VWORLD_ENDPOINT}?${params.toString()}`);
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return null;
  }
  const resp = (json as { response?: Record<string, unknown> })?.response;
  if (!resp || resp.status !== "OK") return null;
  const point = (resp.result as { point?: { x?: string; y?: string } })?.point;
  if (!point?.x || !point?.y) return null;
  const lat = Number(point.y);
  const lng = Number(point.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Kakao 로컬 지오코딩 (REST). 보조 폴백 — VWorld가 NOT_FOUND인 지번을 보완.
 * 주소검색(address) → 실패 시 키워드검색(keyword) 순으로 시도.
 * 헤더: Authorization: KakaoAK {restKey}
 * 응답: { documents: [ { x:lng, y:lat, ... } ] }
 */
const KAKAO_ADDRESS = "https://dapi.kakao.com/v2/local/search/address.json";
const KAKAO_KEYWORD = "https://dapi.kakao.com/v2/local/search/keyword.json";

/** 순수 파서 — Kakao 응답 → LatLng (네트워크/키 불필요, 테스트 대상). */
export function parseKakaoGeocode(json: unknown): LatLng | null {
  const docs = (json as { documents?: Array<{ x?: string; y?: string }> })?.documents;
  if (!Array.isArray(docs) || docs.length === 0) return null;
  const d = docs[0];
  if (!d?.x || !d?.y) return null;
  const lat = Number(d.y);
  const lng = Number(d.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

async function kakaoQuery(restKey: string, url: string, query: string): Promise<LatLng | null> {
  let res: Response;
  try {
    res = await fetch(`${url}?query=${encodeURIComponent(query)}`, {
      headers: { Authorization: `KakaoAK ${restKey}` },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return null;
  }
  return parseKakaoGeocode(json);
}

export async function geocodeKakao(restKey: string, address: string): Promise<LatLng | null> {
  return (
    (await kakaoQuery(restKey, KAKAO_ADDRESS, address)) ??
    (await kakaoQuery(restKey, KAKAO_KEYWORD, address))
  );
}

/**
 * PARCEL → ROAD(VWorld) → Kakao(있으면) 순 폴백.
 * kakaoKey가 없으면 기존(VWorld 전용) 동작과 동일.
 */
export async function geocodeBest(
  vworldKey: string,
  address: string,
  kakaoKey?: string,
): Promise<LatLng | null> {
  const cleaned = cleanAddressForGeocode(address);
  const v =
    (await geocodeVworld(vworldKey, cleaned, "PARCEL")) ??
    (await geocodeVworld(vworldKey, cleaned, "ROAD"));
  if (v) return v;
  if (kakaoKey) return geocodeKakao(kakaoKey, cleaned);
  return null;
}
