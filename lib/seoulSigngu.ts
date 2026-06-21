/** 서울 25개 자치구: 정보몽땅 signguCode(법정동코드 5자리) + 중심좌표(지오코딩 폴백용). */
export interface Signgu {
  code: string;
  name: string;
  lat: number;
  lng: number;
}

export const SEOUL_SIGNGU: Signgu[] = [
  { code: "11110", name: "종로구", lat: 37.5735, lng: 126.979 },
  { code: "11140", name: "중구", lat: 37.5641, lng: 126.9979 },
  { code: "11170", name: "용산구", lat: 37.5311, lng: 126.981 },
  { code: "11200", name: "성동구", lat: 37.5634, lng: 127.0369 },
  { code: "11215", name: "광진구", lat: 37.5385, lng: 127.0823 },
  { code: "11230", name: "동대문구", lat: 37.5744, lng: 127.0396 },
  { code: "11260", name: "중랑구", lat: 37.6063, lng: 127.0925 },
  { code: "11290", name: "성북구", lat: 37.5894, lng: 127.0167 },
  { code: "11305", name: "강북구", lat: 37.6396, lng: 127.0257 },
  { code: "11320", name: "도봉구", lat: 37.6688, lng: 127.0471 },
  { code: "11350", name: "노원구", lat: 37.6542, lng: 127.0568 },
  { code: "11380", name: "은평구", lat: 37.6027, lng: 126.9291 },
  { code: "11410", name: "서대문구", lat: 37.5791, lng: 126.9368 },
  { code: "11440", name: "마포구", lat: 37.5663, lng: 126.9019 },
  { code: "11470", name: "양천구", lat: 37.517, lng: 126.8665 },
  { code: "11500", name: "강서구", lat: 37.5509, lng: 126.8495 },
  { code: "11530", name: "구로구", lat: 37.4954, lng: 126.8874 },
  { code: "11545", name: "금천구", lat: 37.4569, lng: 126.8956 },
  { code: "11560", name: "영등포구", lat: 37.5264, lng: 126.8962 },
  { code: "11590", name: "동작구", lat: 37.5124, lng: 126.9393 },
  { code: "11620", name: "관악구", lat: 37.4784, lng: 126.9516 },
  { code: "11650", name: "서초구", lat: 37.4836, lng: 127.0327 },
  { code: "11680", name: "강남구", lat: 37.5172, lng: 127.0473 },
  { code: "11710", name: "송파구", lat: 37.5145, lng: 127.1066 },
  { code: "11740", name: "강동구", lat: 37.5301, lng: 127.1238 },
];

export const SIGNGU_BY_NAME: Record<string, Signgu> = Object.fromEntries(
  SEOUL_SIGNGU.map((s) => [s.name, s]),
);
