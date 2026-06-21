"use client";

import type { ProjectType, SiDo, StageName, ZoneFilter } from "@/lib/types";
import { STAGE_ORDER } from "@/lib/types";

interface FilterBarProps {
  filter: ZoneFilter;
  onChange: (filter: ZoneFilter) => void;
  resultCount: number;
}

const SIDO_OPTIONS: (SiDo | "전체")[] = ["전체", "서울", "경기"];
const TYPE_OPTIONS: (ProjectType | "전체")[] = ["전체", "재개발", "재건축"];
const STAGE_OPTIONS: (StageName | "전체")[] = ["전체", ...STAGE_ORDER];

export default function FilterBar({ filter, onChange, resultCount }: FilterBarProps) {
  const set = (patch: Partial<ZoneFilter>) => onChange({ ...filter, ...patch });

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-gray-200 bg-white p-4">
      <Field label="지역">
        <select
          className="rounded border border-gray-300 px-2 py-1 text-sm"
          value={filter.sido}
          onChange={(e) => set({ sido: e.target.value as ZoneFilter["sido"] })}
        >
          {SIDO_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </Field>

      <Field label="사업유형">
        <select
          className="rounded border border-gray-300 px-2 py-1 text-sm"
          value={filter.projectType}
          onChange={(e) => set({ projectType: e.target.value as ZoneFilter["projectType"] })}
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </Field>

      <Field label="단계">
        <select
          className="rounded border border-gray-300 px-2 py-1 text-sm"
          value={filter.stage}
          onChange={(e) => set({ stage: e.target.value as ZoneFilter["stage"] })}
        >
          {STAGE_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </Field>

      <Field label="검색(구역/시군구)">
        <input
          className="rounded border border-gray-300 px-2 py-1 text-sm"
          placeholder="예: 강남, 한남"
          value={filter.query}
          onChange={(e) => set({ query: e.target.value })}
        />
      </Field>

      <div className="ml-auto text-sm text-gray-500">
        결과 <span className="font-semibold text-gray-900">{resultCount}</span>개 구역
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      {children}
    </label>
  );
}
