/**
 * 정비구역 주소를 VWorld로 지오코딩해 data/*-zones.json의 좌표를 실좌표로 갱신.
 * 실행: npm run geocode  (VWORLD_API_KEY를 .env.local에서 로드)
 *
 * 캐시(data/geocode-cache.json)로 재실행 시 재호출 최소화. 실패 구역은 기존
 * 시군구 중심 좌표 유지(geocoded=false).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  cleanAddressForGeocode,
  approxDongCentroid,
  geocodeBest,
  ZONE_COORD_OVERRIDE,
  type LatLng,
} from "../lib/geocode";
import type { RedevelopmentZone } from "../lib/types";

const DATA = join(process.cwd(), "data");
const CACHE_PATH = join(DATA, "geocode-cache.json");
const FILES = ["seoul-zones.json", "gyeonggi-zones.json"];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const key = process.env.VWORLD_API_KEY;
  if (!key) {
    console.error("VWORLD_API_KEY 미설정 (.env.local 확인)");
    process.exit(1);
  }
  const kakaoKey = process.env.KAKAO_REST_KEY; // 선택: VWorld NOT_FOUND 보조 폴백
  if (kakaoKey) console.log("KAKAO_REST_KEY 감지 — VWorld 실패분 Kakao 폴백 활성화");

  const cache: Record<string, LatLng | null> = existsSync(CACHE_PATH)
    ? JSON.parse(readFileSync(CACHE_PATH, "utf8"))
    : {};

  let ok = 0;
  let fail = 0;
  let cached = 0;
  let approxOk = 0; // 동-단위 근사로 좌표를 얻은 수(geocoded=false)

  for (const file of FILES) {
    const path = join(DATA, file);
    if (!existsSync(path)) continue;
    const zones = JSON.parse(readFileSync(path, "utf8")) as RedevelopmentZone[];

    for (const z of zones) {
      // 0) 검증된 override 최우선(부정확 대표지번 보정) — 이름 부분일치
      const ov = ZONE_COORD_OVERRIDE.find((o) => z.name.includes(o.match));
      if (ov) {
        z.lat = ov.lat;
        z.lng = ov.lng;
        z.geocoded = true;
        ok++;
        continue;
      }
      const cleaned = cleanAddressForGeocode(z.representativeAddress);
      let coord: LatLng | null;
      // 캐시된 '성공'만 재사용. 실패(null)는 Kakao 폴백이 새로 생겼을 수 있어 재시도.
      if (cleaned in cache && cache[cleaned] !== null) {
        coord = cache[cleaned];
        cached++;
      } else {
        coord = await geocodeBest(key, z.representativeAddress, kakaoKey);
        cache[cleaned] = coord;
        await sleep(120); // rate-friendly
      }
      if (coord) {
        z.lat = coord.lat;
        z.lng = coord.lng;
        z.geocoded = true;
        ok++;
      } else {
        // 정밀 지오코딩 실패(부정확 지번/블럭표기) → 동 중심 테이블 근사. geocoded=false 유지.
        const approx = approxDongCentroid(z.representativeAddress, z.id);
        if (approx) {
          z.lat = approx.lat;
          z.lng = approx.lng;
          z.geocoded = false; // 동 근사 — 정밀 좌표 아님
          approxOk++;
        } else {
          z.geocoded = false;
          fail++;
        }
      }
    }

    writeFileSync(path, JSON.stringify(zones, null, 2), "utf8");
    console.log(`${file}: ${zones.length} zones 갱신`);
  }

  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
  console.log(
    `지오코딩 완료: 정밀 ${ok} (캐시 ${cached}), 동-근사 ${approxOk}, 실패 ${fail}`,
  );
}

main();
