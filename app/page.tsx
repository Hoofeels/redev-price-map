"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import FilterBar from "@/components/FilterBar";
import ZoneDetailPanel from "@/components/ZoneDetailPanel";
import { getAllZones, filterZones } from "@/lib/zones";
import { DEFAULT_FILTER, type RedevelopmentZone, type Transaction, type ZoneFilter } from "@/lib/types";

// Leaflet은 window 의존 → SSR 비활성화 동적 임포트
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-gray-400">
      지도를 불러오는 중…
    </div>
  ),
});

interface LiveData {
  zoneId: string;
  transactions: Transaction[];
  asOf: string;
}

export default function Home() {
  const [filter, setFilter] = useState<ZoneFilter>(DEFAULT_FILTER);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [live, setLive] = useState<LiveData | null>(null);

  const allZones = useMemo(() => getAllZones(), []);
  const zones = useMemo(() => filterZones(allZones, filter), [allZones, filter]);
  const selectedZone = useMemo(
    () => zones.find((z) => z.id === selectedId) ?? null,
    [zones, selectedId],
  );

  // 선택 구역 변경 시 국토부 실거래가 라이브 조회 (키 없으면 available:false → 샘플 유지)
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    fetch(`/api/transactions?zoneId=${encodeURIComponent(selectedId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.available && Array.isArray(data.transactions) && data.transactions.length > 0) {
          setLive({ zoneId: selectedId, transactions: data.transactions, asOf: data.asOf });
        } else {
          setLive(null);
        }
      })
      .catch(() => {
        if (!cancelled) setLive(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // 라이브 데이터가 있으면 실거래가로 교체, 없으면 샘플 유지
  const effectiveZone: RedevelopmentZone | null = useMemo(() => {
    if (!selectedZone) return null;
    if (live && live.zoneId === selectedZone.id) {
      return {
        ...selectedZone,
        transactions: live.transactions,
        source: "국토부 실거래가",
        dataAsOf: live.asOf,
      };
    }
    return selectedZone;
  }, [selectedZone, live]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 bg-gray-900 px-4 py-3 text-white">
        <h1 className="text-base font-bold">서울·경기 재개발/재건축 실거래가 지도</h1>
        <span className="text-xs text-gray-400">
          조합설립인가 ~ 관리처분인가 단계 (MVP)
        </span>
      </header>

      <FilterBar filter={filter} onChange={setFilter} resultCount={zones.length} />

      <main className="flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <MapView zones={zones} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className="w-[380px] shrink-0 border-l border-gray-200">
          <ZoneDetailPanel zone={effectiveZone} onClose={() => setSelectedId(null)} />
        </div>
      </main>
    </div>
  );
}
