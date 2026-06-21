/**
 * 서울 정비구역 경계 폴리곤을 구역에 매칭 → data/zone-boundaries.json.
 * 입력: 서울 열린데이터광장 OA-20957(의제처리구역) SHP (EPSG:5174).
 *   먼저 다운로드: npm run download:boundaries  (temp 폴더에 압축해제됨)
 * 매칭: ATRB_SE=UQ12*(정비사업)만 필터 → 좌표변환 → 마커 point-in-polygon(최소 포함) + 이름 폴백.
 * ⚠️ 공공누리 4유형(재배포 제한) → 로컬 전용. 결과는 skip-worktree로 커밋 제외.
 *
 * 실행: npm run scrape:boundaries [-- --shp=<경로>]
 */
import { open } from "shapefile";
import proj4 from "proj4";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { RedevelopmentZone } from "../lib/types";

proj4.defs(
  "EPSG:5174",
  "+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43",
);
const GIS_DEFAULT = "C:\\Users\\USER\\AppData\\Local\\Temp\\redevmap_gis";
const DATA = join(process.cwd(), "data");
const OUT = join(DATA, "zone-boundaries.json");

type Pt = [number, number]; // [lng, lat]

function findShp(dir: string): string | null {
  if (!existsSync(dir)) return null;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      const r = findShp(p);
      if (r) return r;
    } else if (e.name.toLowerCase().endsWith(".shp")) return p;
  }
  return null;
}

function ringArea(ring: Pt[]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(a / 2);
}

function pointInRing(pt: Pt, ring: Pt[]): boolean {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * 거리 데시메이션 단순화: 직전 보존점에서 tol(도) 이상 떨어진 점만 유지.
 * (폐합 링도 안전 — DP의 zero-length baseline 붕괴 문제 회피). tol≈0.00012deg≈13m.
 */
function simplify(ring: Pt[], tol = 0.00012): Pt[] {
  if (ring.length <= 6) return ring;
  const out: Pt[] = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    const last = out[out.length - 1];
    if (Math.hypot(ring[i][0] - last[0], ring[i][1] - last[1]) > tol) out.push(ring[i]);
  }
  return out.length >= 4 ? out : ring;
}

interface Poly {
  name: string;
  ring: Pt[]; // [lng,lat], WGS84
  area: number;
}

/** geometry(5174) → 외곽 링들(4326, [lng,lat]) */
function ringsFromGeometry(geom: { type: string; coordinates: unknown }): Pt[][] {
  const out: Pt[][] = [];
  const tx = (c: number[]): Pt => proj4("EPSG:5174", "WGS84", [c[0], c[1]]) as Pt;
  if (geom.type === "Polygon") {
    const rings = geom.coordinates as number[][][];
    if (rings[0]) out.push(rings[0].map(tx));
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates as number[][][][]) {
      if (poly[0]) out.push(poly[0].map(tx));
    }
  }
  return out;
}

async function main() {
  const shpArg = process.argv.slice(2).find((a) => a.startsWith("--shp="))?.split("=")[1];
  const shp = shpArg ?? findShp(GIS_DEFAULT);
  if (!shp) {
    console.error(`SHP 못 찾음. 먼저 npm run download:boundaries 실행 (또는 --shp=경로).`);
    process.exit(1);
  }
  const dbf = shp.replace(/\.shp$/i, ".dbf");
  console.log("SHP:", shp);

  // 1) 정비사업(UQ12*) 폴리곤 적재 + 좌표변환
  const polys: Poly[] = [];
  const src = await open(shp, dbf, { encoding: "euc-kr" });
  let r = await src.read();
  while (!r.done) {
    const f = r.value as { properties: Record<string, unknown> | null; geometry: { type: string; coordinates: unknown } | null };
    const atrb = String(f.properties?.ATRB_SE ?? "");
    if (atrb.startsWith("UQ12") && f.geometry) {
      const name = String(f.properties?.DGM_NM ?? "");
      for (const ring of ringsFromGeometry(f.geometry)) {
        if (ring.length >= 4) polys.push({ name, ring, area: ringArea(ring) });
      }
    }
    r = await src.read();
  }
  console.log(`정비사업 폴리곤 ${polys.length}개 적재`);

  // 2) 서울 zone에 매칭
  const zones = JSON.parse(readFileSync(join(DATA, "seoul-zones.json"), "utf8")) as RedevelopmentZone[];
  const boundaries: Record<string, Pt[]> = {};
  for (const z of zones) {
    // 마커가 들어있는 폴리곤 중 가장 작은(가장 구체적인) 것. 이름매칭은 동명이구역 오매칭 위험으로 미사용.
    const pt: Pt = [z.lng, z.lat];
    const containing = polys.filter((p) => pointInRing(pt, p.ring));
    if (!containing.length) continue;
    const pick = containing.reduce((a, b) => (a.area < b.area ? a : b));
    boundaries[z.id] = simplify(pick.ring).map(([lng, lat]) => [lat, lng] as Pt); // [lat,lng]
  }

  writeFileSync(OUT, JSON.stringify(boundaries), "utf8");
  const matched = Object.keys(boundaries).length;
  const pts = Object.values(boundaries).reduce((s, b) => s + b.length, 0);
  console.log(
    `매칭(공간조인) ${matched}/${zones.length}, 평균 ${(pts / Math.max(1, matched)).toFixed(0)}점/폴리곤`,
  );
  console.log("저장:", OUT);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
