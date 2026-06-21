import { XMLParser } from "fast-xml-parser";
import type { PropertyType, Transaction } from "./types";

/**
 * 국토교통부 실거래가 공개시스템 (공공데이터포털 data.go.kr, 1613000)
 * - 아파트 매매(상세): /RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev
 * - 연립다세대 매매:   /RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade
 * - 단독/다가구 매매:  /RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade
 *
 * 모든 함수는 serviceKey를 인자로 받습니다(환경변수 의존 X) → 테스트 가능.
 * 응답은 XML. parseMolitXml은 순수 함수라 키 없이도 픽스처로 검증됩니다.
 *
 * ⚠️ 활용신청 주의: data.go.kr는 API별로 개별 승인됩니다. 키가 apt(Dev)에는
 * 승인됐어도 rh/sh에는 미승인이면 해당 종류는 403을 반환합니다.
 * 라우트(app/api/transactions)는 종류별 실패를 건너뛰고 가능한 데이터만 모읍니다.
 *
 * ⚠️ 데이터 한계: 본 API는 일반 매매(기존매물)만 제공합니다.
 * 입주권/조합원 권리 실거래는 별도 소스가 필요하며(현재 미연동),
 * dealType은 일괄 "기존매물"로 매핑됩니다(AC11 입주권은 추후 소스 보강).
 */

export type MolitKind = "apt" | "rh" | "sh";

const BASE = "https://apis.data.go.kr/1613000";

const ENDPOINT: Record<MolitKind, string> = {
  apt: "/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev",
  rh: "/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade",
  sh: "/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade",
};

const PROPERTY_TYPE: Record<MolitKind, PropertyType> = {
  apt: "아파트",
  rh: "빌라·단독",
  sh: "빌라·단독",
};

export interface MolitQuery {
  serviceKey: string;
  /** 법정동코드 5자리 (시군구) */
  lawdCd: string;
  /** 계약월 YYYYMM */
  dealYmd: string;
  pageNo?: number;
  numOfRows?: number;
}

export function buildMolitUrl(kind: MolitKind, q: MolitQuery): string {
  const params = new URLSearchParams({
    serviceKey: q.serviceKey,
    LAWD_CD: q.lawdCd,
    DEAL_YMD: q.dealYmd,
    pageNo: String(q.pageNo ?? 1),
    numOfRows: String(q.numOfRows ?? 100),
  });
  return `${BASE}${ENDPOINT[kind]}?${params.toString()}`;
}

const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });

function pick(item: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = item[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function toNumber(s: string | null): number | null {
  if (s == null) return null;
  const n = Number(s.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function pad2(s: string): string {
  return s.padStart(2, "0");
}

/** 순수 파서 — XML 문자열 → Transaction[] (네트워크/키 불필요, 테스트 대상) */
export function parseMolitXml(xml: string, kind: MolitKind): Transaction[] {
  const root = parser.parse(xml) as Record<string, unknown>;
  const response = (root.response ?? root) as Record<string, unknown>;
  const body = (response.body ?? {}) as Record<string, unknown>;
  const itemsNode = (body.items ?? {}) as Record<string, unknown>;
  const rawItems = itemsNode.item;
  if (rawItems == null) return [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  const out: Transaction[] = [];
  items.forEach((raw, idx) => {
    const item = raw as Record<string, unknown>;
    const year = pick(item, "dealYear", "년");
    const month = pick(item, "dealMonth", "월");
    const day = pick(item, "dealDay", "일");
    const amount = toNumber(pick(item, "dealAmount", "거래금액"));
    const area = toNumber(pick(item, "excluUseAr", "전용면적"));
    const floorRaw = pick(item, "floor", "층");
    const dong = pick(item, "umdNm", "법정동");
    const name = pick(
      item,
      "aptNm", "아파트",
      "mhouseNm", "연립다세대",
      "houseType", "주택유형",
    ) ?? dong;
    if (year == null || month == null || day == null || amount == null) return;

    out.push({
      id: `${kind}-${year}${pad2(month)}${pad2(day)}-${idx}`,
      date: `${year}-${pad2(month)}-${pad2(day)}`,
      priceManwon: amount,
      areaM2: area ?? 0,
      floor: toNumber(floorRaw),
      complexName: name,
      dong,
      dealType: "기존매물",
      propertyType: PROPERTY_TYPE[kind],
    });
  });
  return out;
}

/**
 * 응답 본문의 resultCode 검사. data.go.kr은 HTTP 200으로도 본문에
 * 오류코드(쿼터초과/미등록키 등)를 담는다. 성공("00"/"000")이 아니면 던진다.
 * (정상 데이터는 resultCode가 없거나 00 → 통과)
 */
export function assertMolitOk(xml: string): void {
  const m = xml.match(/<(?:resultCode|returnReasonCode)>\s*([^<\s]+)\s*<\//i);
  if (!m) return;
  const code = m[1];
  if (code === "00" || code === "000") return;
  const msgMatch = xml.match(/<(?:resultMsg|returnAuthMsg|errMsg)>\s*([^<]*)\s*<\//i);
  throw new Error(`MOLIT result ${code}${msgMatch ? `: ${msgMatch[1].trim()}` : ""}`);
}

/** 실네트워크 호출 — serviceKey 필요. */
export async function fetchMolitTrades(
  kind: MolitKind,
  q: MolitQuery,
): Promise<Transaction[]> {
  const url = buildMolitUrl(kind, q);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`MOLIT ${kind} fetch failed: HTTP ${res.status}`);
  }
  const xml = await res.text();
  assertMolitOk(xml);
  return parseMolitXml(xml, kind);
}

/** 최근 N개월 YYYYMM 목록 (anchor 기준, anchor 포함). */
export function recentDealMonths(anchor: string, months: number): string[] {
  // anchor: YYYYMM
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(4, 6));
  const list: string[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(year, month - 1 - i, 1);
    const yy = d.getFullYear();
    const mm = pad2(String(d.getMonth() + 1));
    list.push(`${yy}${mm}`);
  }
  return list;
}
