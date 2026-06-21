/**
 * 네이버부동산 호가 수집기 (로컬 전용 best-effort) — Playwright 실브라우저 세션.
 * 서버 직접 fetch는 429(anti-bot)라 실브라우저로 단지 페이지를 열어 내부 XHR을 캡처한다.
 *
 * 실행: npm run scrape:naver -- --limit=3        (재건축 단지 N개)
 *       npm run scrape:naver -- --zone=seoul-...  (특정 zone)
 *
 * ⚠️ 네이버 ToS상 자동수집·재배포에 제약. 본 산출물(data/naver-asking.json)은 로컬 분석용이며
 *    공개 사이트에 재호스팅하지 말 것. 네이버 변경 시 깨질 수 있음(best-effort).
 */
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseNaverArticles, type NaverArticle } from "../lib/naver";
import { extractDong } from "../lib/match";
import type { RedevelopmentZone } from "../lib/types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DATA = join(process.cwd(), "data");
const OUT = join(DATA, "naver-asking.json");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ZoneAsking {
  zoneId: string;
  complexNo: string | null;
  complexName: string | null;
  query: string;
  asOf: string;
  articleCount: number;
  articles: NaverArticle[];
}

function loadZones(): RedevelopmentZone[] {
  const out: RedevelopmentZone[] = [];
  for (const f of ["seoul-zones.json", "gyeonggi-zones.json"]) {
    try {
      out.push(...(JSON.parse(readFileSync(join(DATA, f), "utf8")) as RedevelopmentZone[]));
    } catch {
      /* skip */
    }
  }
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const limit = Number(argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 3);
  const zoneArg = argv.find((a) => a.startsWith("--zone="))?.split("=")[1];

  const all = loadZones();
  let targets = all.filter((z) => z.projectType === "재건축" && z.representativeComplex);
  if (zoneArg) targets = all.filter((z) => z.id === zoneArg);
  else targets = targets.slice(0, limit);
  console.log(`대상 ${targets.length} zone (재건축+대표단지${zoneArg ? `, zone=${zoneArg}` : `, limit=${limit}`})`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1366, height: 900 }, locale: "ko-KR" });
  const page = await ctx.newPage();

  let lastArticles: Array<Record<string, unknown>> = [];
  let lastComplexName: string | null = null;
  let lastSearch: Array<Record<string, unknown>> = [];
  page.on("response", async (res) => {
    const u = res.url();
    try {
      if (u.includes("/api/search")) {
        const j = (await res.json()) as Record<string, unknown>;
        const arr = (j.complexes ?? (j.result as Record<string, unknown> | undefined)?.complexes) as unknown;
        if (Array.isArray(arr)) lastSearch = arr as Array<Record<string, unknown>>;
      }
      if (/\/api\/complexes\/\d+(\?|$)/.test(u)) {
        const j = (await res.json()) as Record<string, unknown>;
        if (typeof j.complexName === "string") lastComplexName = j.complexName;
      }
      if (u.includes("/api/articles/complex/")) {
        const j = (await res.json()) as { articleList?: Array<Record<string, unknown>> };
        if (Array.isArray(j.articleList)) lastArticles = j.articleList;
      }
    } catch {
      /* non-json */
    }
  });

  const asOf = new Date().toISOString().slice(0, 10);
  const results: ZoneAsking[] = [];

  for (const z of targets) {
    lastArticles = [];
    lastComplexName = null;
    lastSearch = [];
    const dong = extractDong(z.representativeAddress) ?? "";
    const sigunguShort = z.sigungu.replace(/(특별시|광역시|구|시|군)$/g, "");
    const query = `${dong || z.sigungu} ${z.representativeComplex}`.trim();
    let complexNo: string | null = null;

    try {
      await page.goto(`https://new.land.naver.com/search?sk=${encodeURIComponent(query)}`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await sleep(3000);
      // 1) 단일결과면 /complexes/{n}로 리다이렉트
      complexNo = page.url().match(/complexes\/(\d+)/)?.[1] ?? null;
      // 2) 아니면 검색결과 목록에서 단지명 매칭
      if (!complexNo && lastSearch.length) {
        const norm = (s: string) => s.replace(/\s/g, "");
        const key = norm(z.representativeComplex!);
        // 지역 가드: 후보 객체에 동 또는 시군구가 들어가야 채택(엉뚱한 지역 동명이단지 방지)
        const regionKeys = [norm(dong), norm(sigunguShort)].filter((k) => k.length >= 2);
        const inRegion = (c: Record<string, unknown>) =>
          regionKeys.length === 0 || regionKeys.some((k) => norm(JSON.stringify(c)).includes(k));
        const pick =
          lastSearch.find((c) => norm(String(c.complexName ?? "")).includes(key) && inRegion(c)) ?? null;
        if (pick) {
          complexNo = String(pick.complexNo ?? "") || null;
          if (typeof pick.complexName === "string") lastComplexName = pick.complexName;
        }
      }
    } catch (e) {
      console.log(`  ⚠ search 실패 "${query}": ${(e as Error).message}`);
    }

    if (complexNo) {
      try {
        await page.goto(`https://new.land.naver.com/complexes/${complexNo}?a=APT&b=A1`, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await sleep(4000);
      } catch (e) {
        console.log(`  ⚠ complex ${complexNo} 실패: ${(e as Error).message}`);
      }
    }

    const articles = parseNaverArticles(lastArticles, { saleAndJeonseOnly: true });
    if (!lastComplexName && typeof lastArticles[0]?.articleName === "string") {
      lastComplexName = String(lastArticles[0].articleName);
    }
    results.push({
      zoneId: z.id,
      complexNo,
      complexName: lastComplexName,
      query,
      asOf,
      articleCount: articles.length,
      articles,
    });
    console.log(`  ${z.id} "${query}" → complexNo=${complexNo ?? "-"} name=${lastComplexName ?? "-"} 호가 ${articles.length}건`);
    await sleep(2500); // rate-friendly
  }

  await browser.close();
  writeFileSync(OUT, JSON.stringify(results, null, 2), "utf8");
  const withData = results.filter((r) => r.articleCount > 0).length;
  console.log(`\n저장: data/naver-asking.json — ${results.length} zone, 호가 보유 ${withData}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
