/**
 * 서울 정비사업 정보몽땅 스크래핑 → data/seoul-zones.json
 * 실행: npm run scrape:seoul
 *
 * 25개 자치구를 페이지네이션하며 전 사업장을 받아, 스펙 포함범위
 * (조합설립인가~철거, 재개발/재건축)만 필터해 저장. 인증키 불필요.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { SEOUL_SIGNGU } from "../lib/seoulSigngu";
import { fetchBsnsList, parseBsnsListRows, toZone } from "../lib/cleanup";
import type { RedevelopmentZone } from "../lib/types";

const todayIso = new Date().toISOString().slice(0, 10);

async function scrapeSigngu(code: string, name: string) {
  try {
    const html = await fetchBsnsList(code, 1000);
    return parseBsnsListRows(html);
  } catch (e) {
    console.error(`  ${name} 실패:`, (e as Error).message);
    return [];
  }
}

async function main() {
  const all: RedevelopmentZone[] = [];
  let idx = 0;
  for (const s of SEOUL_SIGNGU) {
    const raws = await scrapeSigngu(s.code, s.name);
    let kept = 0;
    for (const raw of raws) {
      const z = toZone(raw, idx);
      if (z) {
        z.dataAsOf = todayIso;
        all.push(z);
        idx++;
        kept++;
      }
    }
    console.log(`${s.name}: ${raws.length} rows → ${kept} zones`);
  }
  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "data", "seoul-zones.json"),
    JSON.stringify(all, null, 2),
    "utf8",
  );
  console.log(`\nTOTAL ${all.length} zones (기준일 ${todayIso}) → data/seoul-zones.json`);
}

main();
