"use client";

import type { RedevelopmentZone } from "@/lib/types";
import { computeZoneStats, formatManwon } from "@/lib/stats";
import { getAsking } from "@/lib/asking";

interface ZoneDetailPanelProps {
  zone: RedevelopmentZone | null;
  onClose: () => void;
}

export default function ZoneDetailPanel({ zone, onClose }: ZoneDetailPanelProps) {
  if (!zone) {
    return (
      <aside className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-gray-400">
        지도에서 구역을 클릭하면 실거래가 요약과 거래 목록이 표시됩니다.
      </aside>
    );
  }

  const stats = computeZoneStats(zone.transactions);
  const txs = [...zone.transactions].sort((a, b) => b.date.localeCompare(a.date));
  const asking = getAsking(zone.id);
  const askingArticles = asking
    ? [...asking.articles].sort((a, b) => (b.confirmYmd ?? "").localeCompare(a.confirmYmd ?? ""))
    : [];

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto bg-white">
      <header className="flex items-start justify-between border-b border-gray-200 p-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{zone.name}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {zone.sido} {zone.sigungu} · {zone.projectType} ·{" "}
            <span className="font-medium text-gray-700">{zone.stage}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="닫기"
          className="rounded px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          ✕
        </button>
      </header>

      {/* 요약 통계 */}
      <section className="grid grid-cols-2 gap-px bg-gray-200">
        <Stat label="거래 건수" value={`${stats.count}건`} />
        <Stat label="평균가" value={formatManwon(stats.avgPriceManwon)} />
        <Stat
          label="㎡당 단가"
          value={stats.avgPricePerM2 != null ? `${formatManwon(stats.avgPricePerM2)}/㎡` : "-"}
        />
        <Stat label="최근 추이" value={stats.recentTrend} />
      </section>

      <div className="border-b border-gray-200 px-4 py-2 text-xs text-gray-400">
        데이터 기준일 {zone.dataAsOf} · 출처 {zone.source}
        {zone.source === "MOCK" && " (샘플 데이터 — 실데이터 연동 예정)"}
      </div>

      {/* 거래 목록 */}
      <section className="flex-1 p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">실거래 목록</h3>
        {txs.length === 0 ? (
          <p className="text-sm text-gray-400">거래 내역이 없습니다.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-500">
                <th className="py-1">거래일</th>
                <th className="py-1">유형</th>
                <th className="py-1 text-right">전용(㎡)</th>
                <th className="py-1 text-right">층</th>
                <th className="py-1 text-right">거래금액</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t, i) => (
                <tr key={`${t.id}-${i}`} className="border-b border-gray-100">
                  <td className="py-1.5 text-gray-700">{t.date}</td>
                  <td className="py-1.5">
                    <span
                      className={
                        t.dealType === "입주권"
                          ? "rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800"
                          : "rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700"
                      }
                    >
                      {t.dealType}
                    </span>
                  </td>
                  <td className="py-1.5 text-right text-gray-700">{t.areaM2}</td>
                  <td className="py-1.5 text-right text-gray-700">{t.floor ?? "-"}</td>
                  <td className="py-1.5 text-right font-medium text-gray-900">
                    {formatManwon(t.priceManwon)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 네이버 호가(참고) — 로컬 best-effort, 실거래가 아님 */}
      {asking && askingArticles.length > 0 && (
        <section className="border-t border-gray-200 p-4">
          <h3 className="mb-1 text-sm font-semibold text-gray-700">
            호가{" "}
            <span className="text-xs font-normal text-gray-400">
              참고 · 네이버부동산{asking.complexName ? ` ${asking.complexName}` : ""} · {asking.asOf} 기준
            </span>
          </h3>
          <p className="mb-2 text-xs text-amber-600">
            ※ 매도 희망가(호가)이며 실거래가 아닙니다. 참고용.
          </p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-500">
                <th className="py-1">유형</th>
                <th className="py-1">면적</th>
                <th className="py-1 text-right">층</th>
                <th className="py-1 text-right">호가</th>
                <th className="py-1 text-right">확인일</th>
              </tr>
            </thead>
            <tbody>
              {askingArticles.map((a, i) => (
                <tr key={`${a.confirmYmd}-${i}`} className="border-b border-gray-100">
                  <td className="py-1.5">
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">
                      {a.tradeType}
                    </span>
                  </td>
                  <td className="py-1.5 text-gray-700">{a.areaName ?? "-"}</td>
                  <td className="py-1.5 text-right text-gray-700">{a.floorInfo ?? "-"}</td>
                  <td className="py-1.5 text-right font-medium text-gray-900">{a.priceText}</td>
                  <td className="py-1.5 text-right text-gray-400">{a.confirmYmd ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-0.5 text-base font-semibold text-gray-900">{value}</div>
    </div>
  );
}
