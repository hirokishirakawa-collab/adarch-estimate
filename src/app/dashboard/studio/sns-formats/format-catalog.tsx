"use client";

import { useState } from "react";
import { FORMATS, FILTERS, OVERLAYS, type SnsFormat } from "./format-data";
import { FormatModal } from "./format-modal";

export function FormatCatalog({ userId, branchId, clients }: {
  userId: string;
  branchId: string;
  clients: { id: string; name: string; businessType: string }[];
}) {
  const [filters, setFilters] = useState<Record<string, string | null>>({ ind: null, taste: null, pf: null });
  const [selectedFormat, setSelectedFormat] = useState<SnsFormat | null>(null);

  const filtered = FORMATS.filter((f) => {
    if (filters.ind && f.ind !== filters.ind) return false;
    if (filters.taste && f.taste !== filters.taste) return false;
    if (filters.pf && !f.pf.includes(filters.pf)) return false;
    return true;
  });

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(FILTERS).map(([key, f]) => (
          <div key={key} className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
            <span className="text-xs text-zinc-400 px-2">{(f as any).l}</span>
            <button
              onClick={() => setFilters((p) => ({ ...p, [key]: null }))}
              className={`text-xs px-3 py-1.5 rounded-md transition ${!filters[key] ? "bg-white shadow text-zinc-900 font-medium" : "text-zinc-500 hover:text-zinc-700"}`}
            >
              すべて
            </button>
            {(f as any).o.map((opt: { v: string; l: string }) => (
              <button
                key={opt.v}
                onClick={() => setFilters((p) => ({ ...p, [key]: opt.v }))}
                className={`text-xs px-3 py-1.5 rounded-md transition whitespace-nowrap ${filters[key] === opt.v ? "bg-white shadow text-zinc-900 font-medium" : "text-zinc-500 hover:text-zinc-700"}`}
              >
                {opt.l}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Count */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">フォーマット一覧</h2>
        <span className="text-xs text-zinc-400">{filtered.length} / {FORMATS.length}件</span>
        <div className="flex-1 h-px bg-zinc-200" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((f) => (
          <FormatCard key={f.id} format={f} onClick={() => setSelectedFormat(f)} />
        ))}
      </div>

      {/* Modal */}
      {selectedFormat && (
        <FormatModal
          format={selectedFormat}
          onClose={() => setSelectedFormat(null)}
          userId={userId}
          branchId={branchId}
          clients={clients}
        />
      )}
    </div>
  );
}

function FormatCard({ format: f, onClick }: { format: SnsFormat; onClick: () => void }) {
  const ov = OVERLAYS[f.ind] || OVERLAYS.general;
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-zinc-200 overflow-hidden cursor-pointer transition hover:border-fuchsia-300 hover:shadow-lg hover:-translate-y-0.5"
    >
      {/* Preview */}
      <div className="h-44 relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${f.img})` }} />
        <div className="absolute inset-0" style={{ background: ov }} />
        <div className="absolute left-4 bottom-10 z-10 max-w-[60%]">
          <div className="text-base font-bold text-white drop-shadow-lg">{f.nm}</div>
          <div className="text-xs text-white/60">{f.dur} ・ {f.pf.join(" / ").toUpperCase()}</div>
        </div>
        {/* Mini phone */}
        <div className="absolute right-3 top-1/2 -translate-y-[52%] w-[80px] h-[142px] bg-black border border-white/15 rounded-xl overflow-hidden shadow-xl z-10">
          <img src={f.pimg} alt="" className="w-full h-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50" />
          <div className="absolute bottom-4 left-1 right-1 text-center z-10" ref={(el) => { if (el) el.style.cssText = f.ptcss; }}>{f.pt}</div>
        </div>
        {/* Timeline */}
        <div className="absolute bottom-0 left-0 right-0 h-7 bg-black/50 backdrop-blur-sm flex items-center px-3 gap-0.5 z-10">
          {f.st.map((s, i) => (
            <div key={i} className="h-3 rounded-sm" style={{ flex: parseFloat(s.d), background: s.c }} />
          ))}
        </div>
      </div>
      {/* Body */}
      <div className="p-4">
        <p className="text-xs text-zinc-500 leading-relaxed mb-3">{f.desc}</p>
        <div className="flex flex-wrap gap-1">
          {f.tags.map(([label, cls], i) => (
            <span
              key={i}
              className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                cls === "tp" ? "text-indigo-600 border-indigo-200 bg-indigo-50"
                : cls === "ti" ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                : "text-pink-600 border-pink-200 bg-pink-50"
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
