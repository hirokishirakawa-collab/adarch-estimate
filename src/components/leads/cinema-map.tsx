"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  CINEMA_RADIUS_OPTIONS,
  RADIUS_BAND_COLORS,
} from "@/lib/constants/cinema-leads";
import type { ScoredCinemaLead } from "@/lib/constants/cinema-leads";
import { getPriorityLabel } from "@/lib/constants/leads";

interface CinemaMapProps {
  theaterLat: number;
  theaterLng: number;
  theaterName: string;
  leads: ScoredCinemaLead[];
  maxRadius: number; // km
}

export function CinemaMap({
  theaterLat,
  theaterLng,
  theaterName,
  leads,
  maxRadius,
}: CinemaMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // 既存マップを破棄
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current).setView([theaterLat, theaterLng], 13);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    // 劇場マーカー
    const theaterIcon = L.divIcon({
      html: `<div style="background:#1d4ed8;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">🎬</div>`,
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    L.marker([theaterLat, theaterLng], { icon: theaterIcon })
      .addTo(map)
      .bindPopup(`<b>イオンシネマ${theaterName}</b>`);

    // 同心円（大きい方から描画して小さいのが上に来るように）
    const radii = [...CINEMA_RADIUS_OPTIONS].filter((r) => r <= maxRadius).reverse();
    for (const r of radii) {
      const color = RADIUS_BAND_COLORS[r]?.mapColor ?? "#999";
      L.circle([theaterLat, theaterLng], {
        radius: r * 1000,
        color,
        fillColor: color,
        fillOpacity: 0.05,
        weight: 2,
        dashArray: "6 4",
      })
        .addTo(map)
        .bindTooltip(`${r}km`, {
          permanent: true,
          direction: "right",
          className: "leaflet-tooltip-cinema",
        });
    }

    // 企業マーカー
    for (const lead of leads) {
      if (!lead.lat || !lead.lng) continue;

      const priority = getPriorityLabel(lead.score.total);
      const bgColor =
        priority.key === "high"
          ? "#ef4444"
          : priority.key === "normal"
          ? "#eab308"
          : "#a1a1aa";

      const icon = L.divIcon({
        html: `<div style="background:${bgColor};width:10px;height:10px;border-radius:50%;border:1.5px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
        className: "",
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });

      L.marker([lead.lat, lead.lng], { icon })
        .addTo(map)
        .bindPopup(
          `<b>${lead.name}</b><br/>スコア: ${lead.score.total}点<br/>距離: ${lead.distanceKm}km<br/><small>${lead.address}</small>`
        );
    }

    // ズームを合わせる
    const bounds = L.latLngBounds([[theaterLat, theaterLng]]);
    // 最大半径の端を含める
    const offset = (maxRadius / 111) * 1.2;
    bounds.extend([theaterLat + offset, theaterLng + offset]);
    bounds.extend([theaterLat - offset, theaterLng - offset]);
    map.fitBounds(bounds, { padding: [20, 20] });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [theaterLat, theaterLng, theaterName, leads, maxRadius]);

  return (
    <>
      <style>{`
        .leaflet-tooltip-cinema {
          background: rgba(0,0,0,0.6) !important;
          color: white !important;
          border: none !important;
          font-size: 10px !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
        }
        .leaflet-tooltip-cinema::before {
          display: none !important;
        }
      `}</style>
      <div
        ref={mapRef}
        className="w-full h-[400px] rounded-xl border border-zinc-200 overflow-hidden"
      />
    </>
  );
}
