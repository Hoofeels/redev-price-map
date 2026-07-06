"use client";

import "leaflet/dist/leaflet.css";
import { Fragment } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polygon,
  Tooltip,
  GeoJSON,
} from "react-leaflet";
import type { FeatureCollection } from "geojson";
import type { ProjectType, RedevelopmentZone } from "@/lib/types";
import sigunguBoundaries from "@/data/sigungu-boundaries.json";

const TYPE_COLOR: Record<ProjectType, string> = {
  재개발: "#2563eb", // blue
  재건축: "#db2777", // pink
};

interface MapViewProps {
  zones: RedevelopmentZone[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** 서울/경기 중심 */
const CENTER: [number, number] = [37.4, 127.0];

export default function MapView({ zones, selectedId, onSelect }: MapViewProps) {
  return (
    <MapContainer
      center={CENTER}
      zoom={9}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a> · 행정경계 &copy; KOSTAT/POPONG (CC BY 4.0)'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
      />
      {/* 시군구 행정경계(서울·경기) — 방향 파악용. interactive=false로 마커 클릭을 막지 않음 */}
      <GeoJSON
        data={sigunguBoundaries as unknown as FeatureCollection}
        interactive={false}
        style={{ color: "#64748b", weight: 1.2, opacity: 0.5, fill: false, fillOpacity: 0 }}
      />
      {zones.map((z) => {
        const color = TYPE_COLOR[z.projectType];
        const selected = z.id === selectedId;
        return (
          <Fragment key={z.id}>
            {z.boundary && (
              <Polygon
                positions={z.boundary}
                pathOptions={{ color, weight: 1, fillOpacity: selected ? 0.25 : 0.1 }}
              />
            )}
            <CircleMarker
              center={[z.lat, z.lng]}
              radius={selected ? 12 : 8}
              pathOptions={{
                color: selected ? "#111827" : color,
                weight: selected ? 3 : 2,
                fillColor: color,
                fillOpacity: 0.85,
              }}
              eventHandlers={{ click: () => onSelect(z.id) }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <span className="text-xs font-medium">
                  {z.name}
                  <br />
                  {z.projectType} · {z.stage}
                </span>
              </Tooltip>
            </CircleMarker>
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
