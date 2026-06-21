import type { RedevelopmentZone, StageName } from "./types";
import { mapProjectType, extractComplexName } from "./cleanup";
import { GYEONGGI_SIGUN } from "./gyeonggiSigun";

/**
 * 경기데이터드림 "일반 정비사업 추진현황" OpenAPI.
 * 엔드포인트: https://openapi.gg.go.kr/GenrlimprvBizpropls?KEY=&Type=json&pIndex=&pSize=
 * 응답: { GenrlimprvBizpropls: [ {head:[{list_total_count},{RESULT},...]}, {row:[...]} ] }
 *
 * 단계는 단계확정일 필드 유무로 도출(스펙: 조합설립인가~관리처분, 착공 전):
 *  ASSOCTN_FOUND_CONFMTN_DE(조합설립) / BIZ_IMPLMTN_CONFMTN_DE(사업시행) /
 *  MANAGE_DISPOSIT_CONFMTN_DE(관리처분) / STRCONTR_DE(착공) / GENRL_LOTOUT_DE(분양) / COMPLTN_DE(준공)
 */

const ENDPOINT = "https://openapi.gg.go.kr/GenrlimprvBizpropls";

export interface GyeonggiRow {
  SIGUN_NM?: string;
  SIGUN_CD?: string;
  BIZ_TYPE_NM?: string;
  IMPRV_ZONE_NM?: string;
  LOCPLC_ADDR?: string;
  ASSOCTN_FOUND_CONFMTN_DE?: string | null;
  BIZ_IMPLMTN_CONFMTN_DE?: string | null;
  MANAGE_DISPOSIT_CONFMTN_DE?: string | null;
  STRCONTR_DE?: string | null;
  GENRL_LOTOUT_DE?: string | null;
  COMPLTN_DE?: string | null;
  [key: string]: unknown;
}

function notEmpty(v: unknown): boolean {
  return v != null && String(v).trim() !== "";
}

/** 응답 JSON → row 배열 (순수, 테스트 대상). */
export function parseGyeonggiResponse(json: unknown): GyeonggiRow[] {
  const root = json as Record<string, unknown>;
  const arr = root?.GenrlimprvBizpropls as unknown[] | undefined;
  if (!Array.isArray(arr)) return [];
  const rowNode = arr.find(
    (x) => x && typeof x === "object" && "row" in (x as object),
  ) as { row?: GyeonggiRow[] } | undefined;
  return rowNode?.row ?? [];
}

/** 총 건수 추출 */
export function parseTotalCount(json: unknown): number {
  const root = json as Record<string, unknown>;
  const arr = root?.GenrlimprvBizpropls as unknown[] | undefined;
  if (!Array.isArray(arr)) return 0;
  const headNode = arr.find(
    (x) => x && typeof x === "object" && "head" in (x as object),
  ) as { head?: Array<Record<string, unknown>> } | undefined;
  const totItem = headNode?.head?.find((h) => "list_total_count" in h);
  return totItem ? Number(totItem.list_total_count) : 0;
}

/**
 * 단계확정일로 현재 단계 도출.
 * 착공/분양/준공이 시작됐으면 스펙 범위 밖 → null.
 * 조합설립 미확정 → null. 그 외 최상위 확정 단계 반환.
 */
export function deriveGyeonggiStage(row: GyeonggiRow): StageName | null {
  if (notEmpty(row.STRCONTR_DE) || notEmpty(row.GENRL_LOTOUT_DE) || notEmpty(row.COMPLTN_DE)) {
    return null; // 착공 이후
  }
  if (!notEmpty(row.ASSOCTN_FOUND_CONFMTN_DE)) return null; // 조합설립 이전
  if (notEmpty(row.MANAGE_DISPOSIT_CONFMTN_DE)) return "관리처분인가";
  if (notEmpty(row.BIZ_IMPLMTN_CONFMTN_DE)) return "사업시행인가";
  return "조합설립인가";
}

/**
 * 토큰이 단지명이 아니라 "구역명"인지 판정.
 * 단지명으로 매칭하면 항상 0건이므로(예: "행신Ⅱ-1구역", "115-12구역"),
 * 이런 경우 대표단지를 null로 두어 매칭이 법정동(주소) 폴백을 쓰게 한다.
 */
export function looksLikeZoneCode(s: string): boolean {
  return /구역/.test(s) || /[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/.test(s) || /^\d/.test(s);
}

/**
 * 경기데이터드림 원본 문자 깨짐 보정.
 * 소스 DB가 일부 문자를 ASCII '?'(U+003F)로 저장(예: "성지?궁전아파트").
 * '?'는 한국 단지/구역명에 정상적으로 쓰이지 않으므로 결합단지 구분자 '·'로 보정.
 * 코드 레벨 보정이라 재수집 시에도 깨짐이 재유입되지 않는다.
 */
export function correctName(name: string): string {
  return name.includes("?") ? name.replace(/\?/g, "·") : name;
}

/**
 * 경기 재건축 구역명에서 대표 단지명 추출.
 * "영통2구역(매탄주공4,5단지)" → "매탄주공" (괄호 안, 숫자 이전).
 * 괄호 없으면 일반 휴리스틱(은행주공아파트 → 은행주공) 사용.
 * 결과가 구역명 토큰이면(단지 아님) null → 법정동 폴백 매칭에 위임.
 */
export function extractGyeonggiComplex(name: string): string | null {
  const paren = name.match(/\(([^)]+)\)/);
  if (paren) {
    const s = paren[1]
      .replace(/\s+/g, "")
      .replace(/\d.*$/, "") // 숫자 이후 절단 (4,5단지 제거)
      .replace(/(아파트|연립|빌라|단지)$/, "");
    if (s.length >= 2 && !looksLikeZoneCode(s)) return s;
  }
  const fallback = extractComplexName(name);
  if (fallback && looksLikeZoneCode(fallback)) return null;
  return fallback;
}

export function toGyeonggiZone(row: GyeonggiRow, index: number): RedevelopmentZone | null {
  const projectType = mapProjectType(row.BIZ_TYPE_NM ?? "");
  const stage = deriveGyeonggiStage(row);
  if (!projectType || !stage) return null;

  const sigunName = row.SIGUN_NM ?? "";
  const sigun = GYEONGGI_SIGUN[sigunName];
  const jitter = (n: number) => ((index * 9301 + n * 49297) % 233280) / 233280 - 0.5;
  const lat = (sigun?.lat ?? 37.4) + jitter(1) * 0.05;
  const lng = (sigun?.lng ?? 127.2) + jitter(2) * 0.05;

  const zoneName = correctName(row.IMPRV_ZONE_NM ?? "정비구역");
  return {
    id: `gg-${row.SIGUN_CD ?? "x"}-${index}`,
    name: zoneName,
    sido: "경기",
    sigungu: sigunName,
    projectType,
    stage,
    lat,
    lng,
    representativeAddress: (row.LOCPLC_ADDR ?? "").trim() || `경기 ${sigunName}`,
    representativeComplex: projectType === "재건축" ? extractGyeonggiComplex(zoneName) : null,
    dataAsOf: "",
    source: "경기데이터드림(일반정비사업 추진현황)",
    transactions: [],
  };
}

export async function fetchGyeonggi(
  key: string,
  pIndex: number,
  pSize = 300,
): Promise<unknown> {
  const params = new URLSearchParams({
    KEY: key,
    Type: "json",
    pIndex: String(pIndex),
    pSize: String(pSize),
  });
  const res = await fetch(`${ENDPOINT}?${params.toString()}`);
  if (!res.ok) throw new Error(`경기 API fetch 실패: HTTP ${res.status}`);
  return res.json();
}
