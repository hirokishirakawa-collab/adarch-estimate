// ==============================================================
// TVer配信実績の図（依存ライブラリなし・サーバー側で描くSVG）
//   ・1つの図につき系列は1つ（表示回数）。色で系列を分けないので凡例は不要
//   ・marks: 細い棒・データ端は4px丸め・目盛りと軸は控えめ・値は選んだところだけ直接表示
//   ・橙(#F19834)は1画面に1〜2か所だけ（完全視聴率のリングと、推移の最大値）
// ==============================================================

const INK = "#111111";
const SUB = "#6A6A6A";
const RULE = "#E6E4E0";
const FAINT = "#EDEBE8";
const OR = "#F19834";

const num = (n: number) => n.toLocaleString("ja-JP");
const pct1 = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

/** 上端だけ丸めた縦棒 */
function barTop(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} A${rr},${rr} 0 0 1 ${x + rr},${y} H${x + w - rr} A${rr},${rr} 0 0 1 ${x + w},${y + rr} V${y + h} Z`;
}

export type Row = { key: string; impressions: number; completes: number };

/** 横棒ランキング（構成比つき）。系列は1つなので全部同じ色。HTMLで組むので幅に追随する */
export function RankBars({ title, rows, total, limit = 10, unit = "回" }: { title: string; rows: Row[]; total: number; limit?: number; unit?: string }) {
  const shown = rows.slice(0, limit);
  const max = Math.max(...shown.map((r) => r.impressions), 1);
  return (
    <section className="bg-white border border-zinc-200 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-zinc-900 mb-3">{title}</h2>
      <div className="space-y-1.5">
        {shown.map((r) => {
          const share = pct1(r.impressions, total);
          return (
            <div
              key={r.key}
              className="grid items-center gap-3 text-[12px]"
              style={{ gridTemplateColumns: "minmax(88px,max-content) 1fr max-content 40px" }}
              title={`${r.key}　${num(r.impressions)}${unit}（${share}%）・完全視聴 ${pct1(r.completes, r.impressions)}%`}
            >
              <span className="text-zinc-800 truncate">{r.key}</span>
              <span className="h-[13px] rounded" style={{ background: FAINT }}>
                <span className="block h-full rounded-r" style={{ width: `${Math.max(1.5, (r.impressions / max) * 100)}%`, background: INK, borderTopLeftRadius: 2, borderBottomLeftRadius: 2 }} />
              </span>
              <span className="tabular-nums text-zinc-900">{num(r.impressions)}</span>
              <span className="tabular-nums text-right" style={{ color: SUB }}>{share}%</span>
            </div>
          );
        })}
      </div>
      {rows.length > limit && <p className="text-[11px] text-zinc-400 mt-2">上位{limit}件を表示（全{rows.length}件）</p>}
    </section>
  );
}

/** 日別の推移。1日だけ最大値に橙を差す。平均線つき */
export function TrendBars({ title, rows, unit = "回" }: { title: string; rows: { key: string; impressions: number; completes: number }[]; unit?: string }) {
  if (rows.length === 0) return null;
  const W = 900, H = 180, padB = 22;
  const plotH = H - padB;
  const max = Math.max(...rows.map((r) => r.impressions), 1);
  const avg = rows.reduce((a, r) => a + r.impressions, 0) / rows.length;
  const gap = rows.length > 40 ? 1 : 3;
  const slot = W / rows.length;                       // 1本あたりの持ち場
  const bw = Math.min(64, Math.max(2, slot - gap));   // 本数が少ない時は太く、多い時は細く
  const peak = rows.length >= 5 ? rows.reduce((a, b) => (b.impressions > a.impressions ? b : a), rows[0]) : null;
  const step = Math.ceil(rows.length / 12);
  const avgY = plotH - (avg / max) * plotH;
  return (
    <section className="bg-white border border-zinc-200 rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        <span className="text-[11px] text-zinc-500">1日平均 <b className="text-zinc-800 tabular-nums">{num(Math.round(avg))}</b>{unit}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={title}>
        <line x1="0" y1={plotH} x2={W} y2={plotH} stroke={RULE} strokeWidth="1" />
        {rows.length > 1 && <line x1="0" y1={avgY} x2={W} y2={avgY} stroke={SUB} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />}
        {rows.map((r, i) => {
          const h = Math.max(1, (r.impressions / max) * plotH);
          const x = i * slot + (slot - bw) / 2;   // 持ち場の中央に置く＝幅いっぱいに散る
          return (
            <g key={r.key}>
              <title>{`${r.key}　${num(r.impressions)}${unit}・完全視聴 ${pct1(r.completes, r.impressions)}%`}</title>
              <path d={barTop(x, plotH - h, bw, h)} fill={r === peak ? OR : INK} />
              {(i % step === 0 || r === peak) && (
                <text x={x + bw / 2} y={H - 6} fontSize="10" fill={SUB} textAnchor="middle">{r.key}</text>
              )}
            </g>
          );
        })}
      </svg>
    </section>
  );
}

/** 完全視聴率のリング（橙）。中央に%、下に実数 */
export function RateRing({ completes, impressions }: { completes: number; impressions: number }) {
  const rate = impressions > 0 ? completes / impressions : 0;
  const R = 46, C = 2 * Math.PI * R;
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 flex items-center gap-4">
      <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label={`完全視聴率 ${Math.round(rate * 1000) / 10}%`}>
        <circle cx="56" cy="56" r={R} fill="none" stroke={FAINT} strokeWidth="11" />
        <circle cx="56" cy="56" r={R} fill="none" stroke={OR} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={`${C * rate} ${C}`} transform="rotate(-90 56 56)" />
        <text x="56" y="58" textAnchor="middle" fontSize="22" fontWeight="600" fill={INK} className="tabular-nums">{Math.round(rate * 1000) / 10}</text>
        <text x="56" y="74" textAnchor="middle" fontSize="10" fill={SUB}>%</text>
      </svg>
      <div>
        <div className="text-xs text-zinc-500">最後まで見られた割合</div>
        <div className="text-lg font-semibold text-zinc-900 tabular-nums">{num(completes)}<span className="text-xs font-normal text-zinc-500 ml-1">回</span></div>
        <div className="text-[11px] text-zinc-400 mt-0.5">スキップされず、CMが最後まで再生された回数です</div>
      </div>
    </div>
  );
}

/** 大きい数字のタイル */
export function StatTile({ k, v, sub, accent }: { k: string; v: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${accent ? "border-orange-200 bg-orange-50/60" : "border-zinc-200 bg-white"}`}>
      <div className="text-xs text-zinc-500">{k}</div>
      <div className="mt-0.5 text-2xl font-semibold text-zinc-900 tabular-nums leading-tight">{v}</div>
      {sub && <div className="text-[11px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}
