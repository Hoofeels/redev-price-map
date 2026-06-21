/**
 * 경기데이터드림 일반 정비사업 추진현황 → data/gyeonggi-zones.json
 * 실행: npm run scrape:gyeonggi  (GYEONGGI_API_KEY를 .env.local에서 로드)
 *
 * 스펙 포함범위(조합설립인가~관리처분, 착공 전, 재개발/재건축)만 저장.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  fetchGyeonggi,
  parseGyeonggiResponse,
  parseTotalCount,
  toGyeonggiZone,
} from "../lib/gyeonggi";
import type { RedevelopmentZone } from "../lib/types";

const PSIZE = 300;
const todayIso = new Date().toISOString().slice(0, 10);

async function main() {
  const key = process.env.GYEONGGI_API_KEY;
  if (!key) {
    console.error("GYEONGGI_API_KEY 미설정 (.env.local 확인)");
    process.exit(1);
  }

  const first = await fetchGyeonggi(key, 1, PSIZE);
  const total = parseTotalCount(first);
  const pages = Math.max(1, Math.ceil(total / PSIZE));
  const rows = [...parseGyeonggiResponse(first)];
  for (let p = 2; p <= pages; p++) {
    const j = await fetchGyeonggi(key, p, PSIZE);
    rows.push(...parseGyeonggiResponse(j));
  }

  // 경기 API는 구역당 여러 행(면적구간 등)을 반환 → dedup
  const all: RedevelopmentZone[] = [];
  const seen = new Set<string>();
  let idx = 0;
  for (const r of rows) {
    const z = toGyeonggiZone(r, idx);
    if (!z) continue;
    const key = `${z.sigungu}|${z.name}|${z.representativeAddress}`;
    if (seen.has(key)) continue;
    seen.add(key);
    z.dataAsOf = todayIso;
    all.push(z);
    idx++;
  }

  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "data", "gyeonggi-zones.json"),
    JSON.stringify(all, null, 2),
    "utf8",
  );
  console.log(
    `경기: rows=${rows.length}/${total} → ${all.length} zones (기준일 ${todayIso})`,
  );
}

main();
