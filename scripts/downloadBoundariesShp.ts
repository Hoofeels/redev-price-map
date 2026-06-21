/**
 * 서울 정비구역 경계 SHP 다운로드 — 열린데이터광장 OA-20957(의제처리구역, 정비구역 포함).
 * temp 폴더에 zip 다운 + 압축해제. 그 뒤 npm run scrape:boundaries로 매칭.
 * ⚠️ 공공누리 4유형(재배포 제한) → 로컬 전용.
 * 실행: npm run download:boundaries
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { execSync } from "node:child_process";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const OUT = "C:\\Users\\USER\\AppData\\Local\\Temp\\redevmap_gis";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: UA, locale: "ko-KR", acceptDownloads: true });
  const page = await ctx.newPage();

  await page.goto("https://data.seoul.go.kr/dataList/OA-20957/F/1/datasetView.do", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(2500);

  // 최신 파일(seq '9') downloadFile() 호출
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 25000 }),
    page.evaluate(() => (window as unknown as { downloadFile: (s: string) => void }).downloadFile("9")),
  ]);
  const zip = `${OUT}\\${dl.suggestedFilename()}`;
  await dl.saveAs(zip);
  await browser.close();
  console.log("다운로드:", zip);

  // 압축해제
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Path '${zip}' -DestinationPath '${OUT}\\shp' -Force"`,
    { stdio: "inherit" },
  );
  console.log("압축해제:", `${OUT}\\shp`);
  console.log("다음: npm run scrape:boundaries");
}
main().catch((e) => { console.error(e); process.exit(1); });
