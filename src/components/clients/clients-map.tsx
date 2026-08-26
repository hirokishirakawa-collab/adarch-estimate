"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ClientRow } from "@/lib/clients/query";
import { PREF_CENTROIDS } from "@/lib/clients/normalize";

interface Props {
  rows: ClientRow[];
  onSelect: (id: string) => void;
}

/** 座標が無い会社は県庁所在地の周りに少しずらして置く（同じ点に重ならないように） */
function positionOf(r: ClientRow, idx: number): [number, number] | null {
  if (r.lat != null && r.lng != null) return [r.lat, r.lng];
  if (!r.prefecture) return null;
  const c = PREF_CENTROIDS[r.prefecture];
  if (!c) return null;
  const angle = (idx * 137.5 * Math.PI) / 180;
  const radius = 0.02 + (idx % 7) * 0.008;
  return [c[0] + Math.sin(angle) * radius, c[1] + Math.cos(angle) * radius];
}

export function ClientsMap({ rows, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (!mapRef.current) {
      // keyboard:false = コンテナに tabindex を付けない。付けるとクリック時のフォーカスで
      // 外側のレイアウト（overflow-hidden の flex）が横にスクロールし、サイドバーが隠れる
      const map = L.map(ref.current, { scrollWheelZoom: true, keyboard: false }).setView([36.2, 137.5], 5);
      // 国土地理院の淡色地図（無料・日本語ラベル）。OSM の a/b/c サブドメインは 503 を返すようになったため使わない
      L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
        attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>',
        maxZoom: 18,
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
    }
    const layer = layerRef.current!;
    layer.clearLayers();

    const pts: [number, number][] = [];
    rows.forEach((r, i) => {
      const pos = positionOf(r, i);
      if (!pos) return;
      pts.push(pos);
      const size = 8 + Math.min(r.works.length, 6) * 2;
      const marker = L.circleMarker(pos, {
        radius: size,
        color: "#ffffff",
        weight: 2,
        fillColor: r.proven ? "#f97316" : "#a1a1aa",
        fillOpacity: 0.9,
      });
      const rating = r.rating != null && r.ratingCount ? `★${r.rating.toFixed(1)}（${r.ratingCount}件）` : "口コミなし";
      marker.bindTooltip(`<b>${r.name}</b><br>${r.prefecture ?? ""}・${rating}${r.works.length ? `<br>実績 ${r.works.length}本` : ""}`, {
        direction: "top",
        offset: [0, -size],
      });
      marker.on("click", () => onSelect(r.id));
      marker.addTo(layer);
    });

    // 表示範囲は日本国内の点だけで決める（海外の会社があっても世界地図にしない）
    const jp = pts.filter(([lat, lng]) => lat >= 24 && lat <= 46 && lng >= 122 && lng <= 146);
    const fit = jp.length > 0 ? jp : pts;
    if (fit.length > 0 && mapRef.current) {
      mapRef.current.fitBounds(L.latLngBounds(fit), { padding: [24, 24], maxZoom: 9 });
    }
  }, [rows, onSelect]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    // 外側で overflow を切る（タイルが横にはみ出しても scrollWidth が親に伝わらないように）
    <div className="w-full overflow-hidden rounded-xl border border-zinc-200" style={{ contain: "paint" }}>
      <div ref={ref} className="h-[520px] w-full z-0 outline-none" />
    </div>
  );
}
