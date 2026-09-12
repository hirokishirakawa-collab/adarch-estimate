// ==============================================================
// 「どう展開すれば成功しやすいか」＝グループ全社の公開済み実績から出す型
//   ・数字はすべて実績から計算する（推測を混ぜない）
//   ・図は1系列（色で分けない）。代表的な点だけ直接ラベル＝色だけに意味を持たせない
// ==============================================================

import { FREQ } from "@/lib/tver/plan";

const INK = "#111111";
const SUB = "#6A6A6A";
const RULE = "#E6E4E0";
const FAINT = "#EDEBE8";

const num = (n: number) => Math.round(n).toLocaleString("ja-JP");
const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;

export type InsightReport = {
  advertiserName: string;
  /** 単価の条件が特殊な案件（グロス請求など）＝単価の目安からは外す。展開の型としては見える */
  excludeFromBenchmark?: boolean;
  industry: string | null;
  areaLabel: string | null;
  areaPopulation: number | null;
  impressions: number;
  completes: number;
  days: number;
  months: number;
  amount: number;
};

export type DeviceStat = { device: string; impressions: number; completes: number };

const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function Insights({ reports, devices }: { reports: InsightReport[]; devices: DeviceStat[] }) {
  const all = reports.filter((r) => r.impressions > 0 && r.amount > 0 && r.months > 0);
  const usable = all.filter((r) => !r.excludeFromBenchmark); // 単価の目安に使う本数
  if (usable.length < 3) return null;

  // ① 月いくらで何人に届いたか（1万円あたりの到達人数）
  const perMan = usable.map((r) => r.impressions / r.days / FREQ * 30 / (r.amount / r.months) * 10_000);
  const reachPer10k = median(perMan);

  // ② 商圏の大きさと住民への届き方
  const withArea = usable.filter((r) => (r.areaPopulation ?? 0) > 0);
  const pts = withArea.map((r) => {
    const reach30 = (r.impressions / r.days) * 30 / FREQ;
    return { ...r, pop: r.areaPopulation!, reach30, share: (reach30 / r.areaPopulation!) * 100 };
  });
  const small = pts.filter((p) => p.pop < 300_000);
  const big = pts.filter((p) => p.pop >= 1_000_000 && p.pop <= 20_000_000); // 全国配信は商圏の比較から外す
  const smallShare = median(small.map((p) => p.share));
  const bigShare = median(big.map((p) => p.share));

  // ③ 機器ごとの見られ方
  const dev = [...devices].filter((d) => d.impressions > 0).sort((a, b) => b.impressions - a.impressions);
  const bestDev = [...dev].sort((a, b) => b.completes / b.impressions - a.completes / a.impressions)[0];
  const ctv = devices.find((d) => d.device === "CTV");
  const totalImp = devices.reduce((a, d) => a + d.impressions, 0);

  return (
    <section className="bg-white border border-zinc-200 rounded-xl p-5">
      <div className="flex items-baseline gap-2 mb-1">
        <h2 className="text-sm font-semibold text-zinc-900">どう展開すると届くか</h2>
        <span className="text-[11px] text-zinc-400">グループ全社の公開済み実績 {usable.length}本から</span>
      </div>
      <p className="text-xs text-zinc-500 mb-4">お客様への提案で「いくらで、どれだけ届くか」を説明するときの目安です。推計であり保証値ではありません。</p>

      <div className="grid md:grid-cols-3 gap-3 mb-5">
        <Finding
          n="1"
          head={`月1万円で 約${num(reachPer10k)}人`}
          body={`月額（税抜）1万円あたり、ひと月に届いた人数の中央値です。月20万円なら約${num(reachPer10k * 20)}人が目安になります。`}
        />
        {small.length > 0 && big.length > 0 && (
          <Finding
            n="2"
            head={`商圏を絞ると ${(smallShare / Math.max(bigShare, 0.001)).toFixed(0)}倍 深く届く`}
            body={`人口30万人未満の商圏は住民の${smallShare.toFixed(1)}%に届いたのに対し、100万人以上では${bigShare.toFixed(2)}%。同じ予算でも商圏が小さいほど「まちの人に知られる」状態を作れます。`}
          />
        )}
        {ctv && bestDev && (
          <Finding
            n="3"
            head={`いちばん見られるのは テレビ画面`}
            body={`CTV（テレビ受像機）で見られたのが全体の${Math.round((ctv.impressions / Math.max(totalImp, 1)) * 100)}%。完全視聴率も${((ctv.completes / ctv.impressions) * 100).toFixed(1)}%と、スマホ（${dev.filter((d) => d.device.startsWith("SD")).map((d) => `${((d.completes / d.impressions) * 100).toFixed(1)}%`)[0] ?? "—"}）より高い。「テレビに流れるCM」として提案できます。`}
          />
        )}
      </div>

      <Scatter points={pts} />

      <div className="mt-5">
        <h3 className="text-xs font-semibold text-zinc-700 mb-2">機器ごとの見られ方（全社合計）</h3>
        <div className="space-y-1.5">
          {dev.map((d) => {
            const rate = (d.completes / d.impressions) * 100;
            return (
              <div key={d.device} className="grid items-center gap-3 text-[12px]" style={{ gridTemplateColumns: "88px 1fr max-content 74px" }} title={`${d.device}　表示 ${num(d.impressions)}回・完全視聴 ${rate.toFixed(1)}%`}>
                <span className="text-zinc-800">{d.device}</span>
                <span className="h-[13px] rounded" style={{ background: FAINT }}>
                  <span className="block h-full rounded-r" style={{ width: `${(d.impressions / Math.max(...dev.map((x) => x.impressions))) * 100}%`, background: INK, borderTopLeftRadius: 2, borderBottomLeftRadius: 2 }} />
                </span>
                <span className="tabular-nums text-zinc-900">{num(d.impressions)}</span>
                <span className="tabular-nums text-right" style={{ color: SUB }}>完全視聴 {rate.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Finding({ n, head, body }: { n: string; head: string; body: string }) {
  return (
    <div className="border border-zinc-200 rounded-lg p-4">
      <div className="text-[11px] text-zinc-400 mb-1">わかっていること {n}</div>
      <div className="text-[15px] font-semibold text-zinc-900 leading-snug">{head}</div>
      <p className="text-[11.5px] text-zinc-600 mt-1.5 leading-relaxed">{body}</p>
    </div>
  );
}

/** 商圏の人口（対数）× 住民に届いた割合。1系列・墨のみ。端の3件だけ直接ラベル */
function Scatter({ points }: { points: { advertiserName: string; areaLabel: string | null; pop: number; share: number; amount: number; months: number }[] }) {
  if (points.length < 3) return null;
  const W = 900, H = 260, L = 52, R = 16, T = 14, B = 34;
  const pw = W - L - R, ph = H - T - B;
  const lg = (v: number) => Math.log10(Math.max(v, 1));
  const xs = points.map((p) => lg(p.pop));
  const x0 = Math.floor(Math.min(...xs) * 2) / 2, x1 = Math.ceil(Math.max(...xs) * 2) / 2;
  const ymax = Math.max(...points.map((p) => p.share)) * 1.15;
  const px = (p: { pop: number }) => L + ((lg(p.pop) - x0) / Math.max(x1 - x0, 0.001)) * pw;
  const py = (p: { share: number }) => T + ph - (p.share / Math.max(ymax, 0.001)) * ph;
  const ticks = [100_000, 300_000, 1_000_000, 3_000_000, 10_000_000, 100_000_000].filter((t) => lg(t) >= x0 - 0.01 && lg(t) <= x1 + 0.01);
  const labelSet = new Set([
    [...points].sort((a, b) => b.share - a.share)[0],
    [...points].sort((a, b) => a.pop - b.pop)[0],
    [...points].sort((a, b) => b.pop - a.pop)[0],
  ]);
  const fmtPop = (n: number) => (n >= 100_000_000 ? `${Math.round(n / 10_000_000) / 10}億` : n >= 10_000 ? `${Math.round(n / 10_000)}万` : num(n));
  return (
    <div>
      <h3 className="text-xs font-semibold text-zinc-700 mb-1">商圏の大きさ × 住民のどれだけに届いたか</h3>
      <p className="text-[11px] text-zinc-400 mb-2">点ひとつが1本のレポート。左に行くほど商圏が小さく、上に行くほど住民に深く届いています。</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 280 }} role="img" aria-label="商圏の大きさと住民到達率">
        <line x1={L} y1={T + ph} x2={W - R} y2={T + ph} stroke={RULE} />
        <line x1={L} y1={T} x2={L} y2={T + ph} stroke={RULE} />
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={L} y1={T + ph - ph * f} x2={W - R} y2={T + ph - ph * f} stroke={RULE} strokeDasharray="2 4" opacity="0.7" />
            <text x={L - 6} y={T + ph - ph * f + 4} fontSize="10" fill={SUB} textAnchor="end">{(ymax * f).toFixed(1)}%</text>
          </g>
        ))}
        {ticks.map((t) => (
          <text key={t} x={px({ pop: t })} y={H - 12} fontSize="10" fill={SUB} textAnchor="middle">{fmtPop(t)}人</text>
        ))}
        {points.map((p, i) => {
          const cx = px(p), cy = py(p);
          const flip = cx > W * 0.62;              // 右端では左側に出す
          const tw = 214, th = 80;
          const tx = flip ? cx - tw - 12 : cx + 12;
          const ty = Math.min(Math.max(cy - th / 2, 2), H - th - 2);
          return (
            <g key={i} className="group">
              {/* 当たり判定を広げる（見えない円） */}
              <circle cx={cx} cy={cy} r="16" fill="transparent" />
              <circle cx={cx} cy={cy} r="6" fill={INK} stroke="#fff" strokeWidth="2" className="group-hover:stroke-[3]" />
              {labelSet.has(p) && (
                <text x={cx + 10} y={cy + 4} fontSize="10.5" fill={INK} className="group-hover:opacity-0">
                  {(p.areaLabel ?? p.advertiserName).slice(0, 14)}（{p.share < 0.1 ? p.share.toFixed(2) : p.share.toFixed(1)}%）
                </text>
              )}
              {/* カーソルを乗せると出る吹き出し（JSなし・CSSだけ） */}
              <g className="opacity-0 group-hover:opacity-100 pointer-events-none" style={{ transition: "opacity .12s" }}>
                <rect x={tx} y={ty} width={tw} height={th} rx="6" fill={INK} />
                <text x={tx + 10} y={ty + 19} fontSize="11" fill="#fff" fontWeight="600">{p.advertiserName.slice(0, 18)}</text>
                <text x={tx + 10} y={ty + 35} fontSize="10.5" fill="#E6E4E0">{(p.areaLabel ?? "商圏未設定").slice(0, 24)}</text>
                <text x={tx + 10} y={ty + 51} fontSize="10.5" fill="#E6E4E0">人口{fmtPop(p.pop)}人・月{yen(p.amount / p.months)}</text>
                <text x={tx + 10} y={ty + 68} fontSize="11" fill="#fff" fontWeight="600">住民の{p.share < 0.1 ? p.share.toFixed(2) : p.share.toFixed(1)}%に到達</text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
