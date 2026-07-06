import { NextResponse } from "next/server";
import { getAllZones } from "@/lib/zones";
import { getLawdCode } from "@/lib/lawd";
import {
  fetchMolitTrades,
  recentDealMonths,
  type MolitKind,
} from "@/lib/molit";
import { matchTradesToZone } from "@/lib/match";
import type { Transaction } from "@/lib/types";

/**
 * GET /api/transactions?zoneId=seoul-002&months=6
 * 국토부 실거래가를 시군구 단위로 가져와 대표 단지/주소 기준으로 구역에 매칭.
 * MOLIT_API_KEY 미설정 시 available:false 로 graceful degrade.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zoneId = searchParams.get("zoneId");
  const months = Math.min(12, Math.max(1, Number(searchParams.get("months") ?? 6)));

  if (!zoneId) {
    return NextResponse.json({ error: "zoneId required" }, { status: 400 });
  }

  const zone = getAllZones().find((z) => z.id === zoneId);
  if (!zone) {
    return NextResponse.json({ error: "zone not found" }, { status: 404 });
  }

  const serviceKey = process.env.MOLIT_API_KEY;
  if (!serviceKey) {
    return NextResponse.json({
      available: false,
      reason: "MOLIT_API_KEY not set — .env에 공공데이터포털 서비스키를 넣으세요.",
      zoneId,
      transactions: [],
    });
  }

  const lawdCd = getLawdCode(zone);
  if (!lawdCd) {
    return NextResponse.json({
      available: false,
      reason: `법정동코드 미등록 시군구: ${zone.sigungu}`,
      zoneId,
      transactions: [],
    });
  }

  // 신고지연(계약 후 ~30일)으로 당월은 비어있어 전월부터 앵커
  const now = new Date();
  const anchorDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const anchor = `${anchorDate.getFullYear()}${String(anchorDate.getMonth() + 1).padStart(2, "0")}`;
  const dealMonths = recentDealMonths(anchor, months);
  const kinds: MolitKind[] =
    zone.projectType === "재건축" ? ["apt"] : ["rh", "sh", "apt"];

  // (종류 × 월) 최대 18회 호출. 순차로 하면 30초+라 병렬화하되,
  // data.go.kr 폭주(레이트리밋)로 인한 데이터 누락을 막기 위해 동시 6개로 제한.
  // 각 (종류,월)은 독립 시도 — 일부 실패가 전체를 막지 않는다.
  const jobs = kinds.flatMap((kind) =>
    dealMonths.map((dealYmd) => ({ kind, dealYmd })),
  );
  type JobResult =
    | { ok: true; kind: MolitKind; trades: Transaction[] }
    | { ok: false; kind: MolitKind; error: string };

  const CONCURRENCY = 6;
  const results: JobResult[] = [];
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(
      batch.map(async ({ kind, dealYmd }): Promise<JobResult> => {
        try {
          const trades = await fetchMolitTrades(kind, { serviceKey, lawdCd, dealYmd });
          return { ok: true, kind, trades };
        } catch (e) {
          return { ok: false, kind, error: e instanceof Error ? e.message : "fetch error" };
        }
      }),
    );
    results.push(...settled);
  }

  const all: Transaction[] = [];
  const failedKinds = new Set<string>();
  let anySuccess = false;
  let lastError: string | null = null;
  for (const r of results) {
    if (r.ok) {
      all.push(...r.trades);
      anySuccess = true;
    } else {
      failedKinds.add(r.kind);
      lastError = r.error;
    }
  }

  if (!anySuccess) {
    return NextResponse.json(
      {
        available: false,
        reason: `국토부 API 호출 실패 (미승인/쿼터초과 등): ${lastError ?? failedKinds.size + "개 종류 실패"}`,
        zoneId,
        transactions: [],
      },
      { status: 502 },
    );
  }
  const skippedKinds = [...failedKinds];

  const matched = matchTradesToZone(zone, all);
  return NextResponse.json({
    available: true,
    zoneId,
    lawdCd,
    asOf: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    fetched: all.length,
    matched: matched.length,
    skippedKinds,
    transactions: matched,
  });
}
