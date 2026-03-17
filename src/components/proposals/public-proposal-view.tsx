"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Download, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

// ─── ブランドカラー（明るめ） ───
const brand = {
  primary: "#0D1A2F",
  accent: "#B8943E",
  accentLight: "#D4B96A",
  bg: "#FFFFFF",
  slideBg: "#FAFAF8",
  canvasBg: "#F0EFEC",
  text: "#1A1A1A",
  textSub: "#6B7280",
  border: "#E8E6E1",
};

interface ProposalContent {
  cover: { title: string; subtitle: string; date: string; to: string };
  companyIntro: { heading: string; description: string; strengths: string[] };
  proposal: { heading: string; challenge: string; solutions: { title: string; description: string }[] };
  cases: { heading: string; items: { title: string; description: string }[] };
  nextSteps: { heading: string; steps: string[]; contact: string };
}

interface PublicProposalViewProps {
  proposal: {
    id: string;
    companyName: string;
    title: string | null;
    content: unknown;
    isPublished: boolean;
    publishedAt: Date | null;
  };
  slug: string;
  preview?: boolean;
}

const TOTAL_SLIDES = 6;

export function PublicProposalView({ proposal, preview }: PublicProposalViewProps) {
  const c = proposal.content as ProposalContent;
  const companyName = proposal.companyName;
  const recipientName = c.cover.to;
  const [currentSlide, setCurrentSlide] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const viewIdRef = useRef<string | null>(null);
  const startTimeRef = useRef(Date.now());
  const maxSlideRef = useRef(0);

  // ─── スライドナビゲーション ───
  const goTo = useCallback((idx: number) => {
    const next = Math.max(0, Math.min(TOTAL_SLIDES - 1, idx));
    setCurrentSlide(next);
    if (next > maxSlideRef.current) maxSlideRef.current = next;
  }, []);

  const goNext = useCallback(() => goTo(currentSlide + 1), [currentSlide, goTo]);
  const goPrev = useCallback(() => goTo(currentSlide - 1), [currentSlide, goTo]);

  // ─── キーボード操作 ───
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); goPrev(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev]);

  // ─── トラッキング: ページビュー（プレビュー時はスキップ） ───
  useEffect(() => {
    if (preview) return;
    fetch("/api/tracking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposalId: proposal.id, type: "pageview" }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.viewId) viewIdRef.current = data.viewId;
      })
      .catch(() => {});
  }, [proposal.id, preview]);

  // ─── トラッキング: 離脱時送信 ───
  const sendUpdate = useCallback(() => {
    if (!viewIdRef.current) return;
    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    const scrollDepth = Math.round((maxSlideRef.current / (TOTAL_SLIDES - 1)) * 100);
    navigator.sendBeacon(
      "/api/tracking",
      new Blob(
        [JSON.stringify({
          proposalId: proposal.id,
          type: "update",
          viewId: viewIdRef.current,
          duration,
          scrollDepth,
        })],
        { type: "application/json" }
      )
    );
  }, [proposal.id]);

  useEffect(() => {
    const handleBeforeUnload = () => sendUpdate();
    window.addEventListener("beforeunload", handleBeforeUnload);
    const interval = setInterval(sendUpdate, 30000);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInterval(interval);
      sendUpdate();
    };
  }, [sendUpdate]);

  // ─── PDF ダウンロード ───
  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { ProposalPdfDocument } = await import("./proposal-pdf");
      const blob = await pdf(<ProposalPdfDocument content={c} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `提案書_${companyName}_${new Date().toISOString().split("T")[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF生成エラー:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      style={{ background: brand.canvasBg, height: "100vh", overflow: "hidden" }}
      className="flex flex-col"
    >
      {/* ━━━ ヘッダーバー ━━━ */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-6 py-2.5"
        style={{
          background: brand.bg,
          borderBottom: `1px solid ${brand.border}`,
        }}
      >
        <div className="flex items-center gap-3">
          <Image src="/logo-adarch.png" alt="Ad Arch Group" width={120} height={30} className="h-6 w-auto" />
          <span className="text-xs" style={{ color: brand.border }}>|</span>
          <p className="text-sm font-medium" style={{ color: brand.text }}>
            {companyName} 様 ご提案書
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs" style={{ color: brand.textSub }}>
            {currentSlide + 1} / {TOTAL_SLIDES}
          </span>
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium rounded transition-all"
            style={{
              background: downloading ? brand.accent + "66" : brand.accent,
              color: brand.bg,
              letterSpacing: "0.05em",
            }}
          >
            {downloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            PDF
          </button>
        </div>
      </header>

      {/* ━━━ スライドエリア ━━━ */}
      <div className="flex-1 relative flex items-center justify-center px-6 py-4">
        {/* 左矢印 */}
        {currentSlide > 0 && (
          <button
            onClick={goPrev}
            className="absolute left-4 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-md"
            style={{ background: brand.bg, border: `1px solid ${brand.border}` }}
          >
            <ChevronLeft className="w-5 h-5" style={{ color: brand.text }} />
          </button>
        )}

        {/* 右矢印 */}
        {currentSlide < TOTAL_SLIDES - 1 && (
          <button
            onClick={goNext}
            className="absolute right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-md"
            style={{ background: brand.bg, border: `1px solid ${brand.border}` }}
          >
            <ChevronRight className="w-5 h-5" style={{ color: brand.text }} />
          </button>
        )}

        {/* スライドカード */}
        <div
          className="w-full rounded-lg shadow-lg overflow-hidden"
          style={{
            maxWidth: 960,
            aspectRatio: "16 / 9",
            background: brand.slideBg,
            border: `1px solid ${brand.border}`,
          }}
        >
          {/* ━━━ スライド0: 表紙 ━━━ */}
          {currentSlide === 0 && (
            <div className="w-full h-full relative overflow-hidden" style={{ background: "#FAFAFA" }}>
              {/* アーチ（つなぐ）ライン装飾 — 直線的に右上へ駆け上がる */}
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 960 540">
                {/* ブルー: メインの上昇ライン */}
                <line x1="-20" y1="500" x2="980" y2="-20" stroke="#4285F4" strokeWidth="2.5" opacity="0.18" />
                <line x1="-20" y1="510" x2="980" y2="-10" stroke="#4285F4" strokeWidth="0.8" opacity="0.08" />
                {/* レッド: 少しずらして並走 */}
                <line x1="80" y1="560" x2="920" y2="20" stroke="#EA4335" strokeWidth="2" opacity="0.14" />
                {/* イエロー: 中盤から急角度 */}
                <line x1="250" y1="560" x2="960" y2="40" stroke="#FBBC04" strokeWidth="2.5" opacity="0.16" />
                <line x1="265" y1="560" x2="970" y2="50" stroke="#FBBC04" strokeWidth="0.8" opacity="0.07" />
                {/* グリーン: 最も急角度 */}
                <line x1="450" y1="560" x2="900" y2="30" stroke="#34A853" strokeWidth="2" opacity="0.14" />
                {/* 交差ノード */}
                <circle cx="520" cy="240" r="3.5" fill="#4285F4" opacity="0.28" />
                <circle cx="580" cy="220" r="3" fill="#EA4335" opacity="0.22" />
                <circle cx="650" cy="180" r="3.5" fill="#FBBC04" opacity="0.25" />
                <circle cx="750" cy="120" r="3" fill="#34A853" opacity="0.22" />
                {/* ノード間の横接続 */}
                <line x1="520" y1="240" x2="580" y2="220" stroke="#EA4335" strokeWidth="0.5" opacity="0.10" />
                <line x1="580" y1="220" x2="650" y2="180" stroke="#FBBC04" strokeWidth="0.5" opacity="0.08" />
                <line x1="650" y1="180" x2="750" y2="120" stroke="#34A853" strokeWidth="0.5" opacity="0.08" />
                {/* 右上の勢いアクセント（短い直線） */}
                <line x1="850" y1="80" x2="940" y2="20" stroke="#4285F4" strokeWidth="1.5" opacity="0.12" strokeLinecap="round" />
                <line x1="870" y1="100" x2="950" y2="50" stroke="#EA4335" strokeWidth="1" opacity="0.10" strokeLinecap="round" />
              </svg>
              {/* 左のマルチカラーライン（縦） */}
              <div className="absolute left-12 top-1/4 bottom-1/4 flex flex-col gap-0" style={{ width: 3 }}>
                <div className="flex-1 rounded-full" style={{ background: "#4285F4" }} />
                <div className="flex-1 rounded-full" style={{ background: "#EA4335" }} />
                <div className="flex-1 rounded-full" style={{ background: "#FBBC04" }} />
                <div className="flex-1 rounded-full" style={{ background: "#34A853" }} />
              </div>

              {/* コンテンツ */}
              <div className="relative z-10 h-full flex flex-col justify-between px-16 py-10">
                {/* 上部: ロゴ + 宛先 */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <Image src="/logo-adarch.png" alt="Ad Arch Group" width={180} height={45} className="h-8 w-auto" />
                    <div className="flex gap-0.5 ml-2">
                      <div className="w-1.5 h-6 rounded-sm" style={{ background: "#4285F4" }} />
                      <div className="w-1.5 h-6 rounded-sm" style={{ background: "#EA4335" }} />
                      <div className="w-1.5 h-6 rounded-sm" style={{ background: "#FBBC04" }} />
                      <div className="w-1.5 h-6 rounded-sm" style={{ background: "#34A853" }} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs tracking-wider font-medium" style={{ color: "#4285F4" }}>
                      PREPARED FOR
                    </p>
                    <p className="text-sm font-medium mt-1" style={{ color: brand.primary }}>
                      {recipientName}
                    </p>
                  </div>
                </div>

                {/* 中央: タイトル */}
                <div className="max-w-lg">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="flex gap-1">
                      <div className="w-3 h-1 rounded-full" style={{ background: "#4285F4" }} />
                      <div className="w-3 h-1 rounded-full" style={{ background: "#EA4335" }} />
                      <div className="w-3 h-1 rounded-full" style={{ background: "#FBBC04" }} />
                      <div className="w-3 h-1 rounded-full" style={{ background: "#34A853" }} />
                    </div>
                    <p className="text-xs tracking-widest font-bold" style={{ color: brand.textSub }}>
                      PROPOSAL
                    </p>
                  </div>
                  <h1
                    className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4"
                    style={{ color: brand.primary, letterSpacing: "0.02em" }}
                  >
                    {c.cover.title}
                  </h1>
                  <p className="text-sm sm:text-base font-light leading-relaxed" style={{ color: brand.textSub }}>
                    {c.cover.subtitle}
                  </p>
                </div>

                {/* 下部: 日付 + Confidential */}
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs tracking-wider mb-1" style={{ color: brand.textSub }}>DATE</p>
                    <p className="text-sm font-medium" style={{ color: brand.primary }}>{c.cover.date}</p>
                  </div>
                  <p className="text-xs" style={{ color: "#B0ADA6" }}>
                    Confidential — {companyName} 様限定
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ━━━ スライド1: 会社紹介 ━━━ */}
          {currentSlide === 1 && (
            <div className="w-full h-full relative overflow-hidden" style={{ background: brand.slideBg }}>
              <ArchLines variant={1} />
              <div className="relative z-10 h-full flex flex-col justify-center px-12 sm:px-16 py-10">
                <SlideHeader
                  label={`${companyName} 様への私たちの紹介`}
                  title={c.companyIntro.heading}
                />
                <p
                  className="text-sm leading-relaxed mb-8"
                  style={{ color: brand.textSub, maxWidth: 600 }}
                >
                  {c.companyIntro.description}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {c.companyIntro.strengths.map((s, i) => {
                    const colors = ["#4285F4", "#EA4335", "#FBBC04", "#34A853"];
                    return (
                      <div
                        key={i}
                        className="rounded-lg px-5 py-5 text-center"
                        style={{
                          background: brand.bg,
                          border: `1px solid ${brand.border}`,
                        }}
                      >
                        <div
                          className="w-8 h-0.5 mx-auto mb-3"
                          style={{ background: colors[i % colors.length] }}
                        />
                        <p className="text-sm font-medium" style={{ color: brand.text }}>{s}</p>
                      </div>
                    );
                  })}
                </div>
                <SlideFooter companyName={companyName} slideNum={2} total={TOTAL_SLIDES} />
              </div>
            </div>
          )}

          {/* ━━━ スライド2: 課題 & 提案 ━━━ */}
          {currentSlide === 2 && (
            <div className="w-full h-full relative overflow-hidden" style={{ background: brand.slideBg }}>
              <ArchLines variant={2} />
              <div className="relative z-10 h-full flex flex-col justify-center px-12 sm:px-16 py-10 overflow-y-auto">
                <SlideHeader
                  label={`${companyName} 様の課題に対するご提案`}
                  title={c.proposal.heading}
                />
                {/* 課題ボックス */}
                <div
                  className="rounded-lg px-5 py-4 mb-5"
                  style={{
                    background: brand.bg,
                    borderLeft: `3px solid #EA4335`,
                  }}
                >
                  <p className="text-xs font-medium tracking-wider mb-1" style={{ color: "#EA4335" }}>
                    {companyName} 様の課題
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: brand.text }}>
                    {c.proposal.challenge}
                  </p>
                </div>
                {/* ソリューション */}
                <div className="space-y-2.5">
                  {c.proposal.solutions.map((sol, i) => {
                    const colors = ["#4285F4", "#34A853", "#FBBC04", "#EA4335"];
                    return (
                      <div
                        key={i}
                        className="rounded-lg px-5 py-3.5"
                        style={{
                          background: brand.bg,
                          border: `1px solid ${brand.border}`,
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: colors[i % colors.length], color: "#FFFFFF" }}
                          >
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <div>
                            <p className="text-sm font-bold mb-0.5" style={{ color: brand.text }}>
                              {sol.title}
                            </p>
                            <p className="text-xs leading-relaxed" style={{ color: brand.textSub }}>
                              {sol.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <SlideFooter companyName={companyName} slideNum={3} total={TOTAL_SLIDES} />
              </div>
            </div>
          )}

          {/* ━━━ スライド3: 実績・事例 ━━━ */}
          {currentSlide === 3 && (
            <div className="w-full h-full relative overflow-hidden" style={{ background: brand.slideBg }}>
              <ArchLines variant={3} />
              <div className="relative z-10 h-full flex flex-col justify-center px-12 sm:px-16 py-10">
                <SlideHeader
                  label={`${companyName} 様と同業界での実績`}
                  title={c.cases.heading}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {c.cases.items.map((item, i) => {
                    const colors = ["#4285F4", "#34A853", "#FBBC04", "#EA4335"];
                    return (
                      <div
                        key={i}
                        className="rounded-lg px-5 py-5"
                        style={{
                          background: brand.bg,
                          border: `1px solid ${brand.border}`,
                          borderTop: `3px solid ${colors[i % colors.length]}`,
                        }}
                      >
                        <p className="text-sm font-bold mb-2" style={{ color: brand.text }}>
                          {item.title}
                        </p>
                        <p className="text-xs leading-relaxed" style={{ color: brand.textSub }}>
                          {item.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <SlideFooter companyName={companyName} slideNum={4} total={TOTAL_SLIDES} />
              </div>
            </div>
          )}

          {/* ━━━ スライド4: クリエイティブ提案について ━━━ */}
          {currentSlide === 4 && (
            <div className="w-full h-full relative overflow-hidden" style={{ background: brand.slideBg }}>
              <ArchLines variant={3} />
              <div className="relative z-10 h-full flex flex-col items-center justify-center px-12 sm:px-16 py-10 text-center">
                <div className="flex gap-1 mb-6">
                  <div className="w-3 h-0.5 rounded-full" style={{ background: "#4285F4" }} />
                  <div className="w-3 h-0.5 rounded-full" style={{ background: "#EA4335" }} />
                  <div className="w-3 h-0.5 rounded-full" style={{ background: "#FBBC04" }} />
                  <div className="w-3 h-0.5 rounded-full" style={{ background: "#34A853" }} />
                </div>
                <p className="text-xs tracking-widest font-medium mb-4" style={{ color: brand.textSub }}>
                  CREATIVE PROPOSAL
                </p>
                <h2
                  className="text-2xl sm:text-3xl font-bold leading-tight mb-6"
                  style={{ color: brand.primary, letterSpacing: "0.02em" }}
                >
                  クリエイティブのご提案について
                </h2>
                <p className="text-sm leading-relaxed max-w-md" style={{ color: brand.textSub }}>
                  クリエイティブのご提案につきましては<br />
                  ヒアリングを踏まえ、貴社専用の<br />
                  オリジナルプランをご用意いたします。
                </p>
                <div className="flex gap-1 mt-8">
                  <div className="w-3 h-0.5 rounded-full" style={{ background: "#4285F4" }} />
                  <div className="w-3 h-0.5 rounded-full" style={{ background: "#EA4335" }} />
                  <div className="w-3 h-0.5 rounded-full" style={{ background: "#FBBC04" }} />
                  <div className="w-3 h-0.5 rounded-full" style={{ background: "#34A853" }} />
                </div>
                <SlideFooter companyName={companyName} slideNum={5} total={TOTAL_SLIDES} />
              </div>
            </div>
          )}

          {/* ━━━ スライド5: ネクストステップ ━━━ */}
          {currentSlide === 5 && (
            <div className="w-full h-full relative overflow-hidden" style={{ background: brand.slideBg }}>
              <ArchLines variant={4} />
              <div className="relative z-10 h-full flex flex-col justify-center px-12 sm:px-16 py-10">
                <SlideHeader
                  label={`${companyName} 様とのお取り組みに向けて`}
                  title={c.nextSteps.heading}
                />
                <div className="flex gap-8">
                  {/* ステップリスト */}
                  <div className="flex-1 space-y-3">
                    {c.nextSteps.steps.map((step, i) => {
                      const colors = ["#4285F4", "#EA4335", "#FBBC04", "#34A853"];
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <div
                            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                            style={{ background: colors[i % colors.length] }}
                          >
                            <span className="text-xs font-bold" style={{ color: "#FFFFFF" }}>
                              {String(i + 1).padStart(2, "0")}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed pt-1" style={{ color: brand.text }}>
                            {step}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  {/* CTA */}
                  <div
                    className="flex-1 rounded-lg px-6 py-6 flex flex-col items-center justify-center text-center relative overflow-hidden"
                    style={{ background: brand.primary }}
                  >
                    <div className="flex gap-1 mb-3">
                      <div className="w-3 h-0.5 rounded-full" style={{ background: "#4285F4" }} />
                      <div className="w-3 h-0.5 rounded-full" style={{ background: "#EA4335" }} />
                      <div className="w-3 h-0.5 rounded-full" style={{ background: "#FBBC04" }} />
                      <div className="w-3 h-0.5 rounded-full" style={{ background: "#34A853" }} />
                    </div>
                    <p className="text-xs tracking-wider mb-2" style={{ color: brand.accent }}>
                      CONTACT
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: "#FFFFFFCC" }}>
                      {c.nextSteps.contact}
                    </p>
                    <div className="flex gap-1 mt-3">
                      <div className="w-3 h-0.5 rounded-full" style={{ background: "#4285F4" }} />
                      <div className="w-3 h-0.5 rounded-full" style={{ background: "#EA4335" }} />
                      <div className="w-3 h-0.5 rounded-full" style={{ background: "#FBBC04" }} />
                      <div className="w-3 h-0.5 rounded-full" style={{ background: "#34A853" }} />
                    </div>
                  </div>
                </div>
                <SlideFooter companyName={companyName} slideNum={6} total={TOTAL_SLIDES} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ━━━ スライドインジケーター ━━━ */}
      <div className="flex-shrink-0 flex items-center justify-center gap-2 py-3">
        {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="rounded-full transition-all"
            style={{
              width: currentSlide === i ? 24 : 8,
              height: 8,
              background: currentSlide === i ? brand.accent : "#D1CFC8",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── サブコンポーネント ───

function ArchLines({ variant }: { variant: number }) {
  // 各スライドごとに異なるアーチパターン
  const patterns: Record<number, React.ReactNode> = {
    1: (
      // 右上へ上昇（表紙と同じ方向、控えめ）
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 960 540">
        <line x1="980" y1="560" x2="-20" y2="60" stroke="#4285F4" strokeWidth="2" opacity="0.10" />
        <line x1="980" y1="520" x2="100" y2="-20" stroke="#EA4335" strokeWidth="1.5" opacity="0.08" />
        <line x1="980" y1="480" x2="250" y2="-20" stroke="#FBBC04" strokeWidth="2" opacity="0.10" />
        <line x1="980" y1="440" x2="400" y2="-20" stroke="#34A853" strokeWidth="1.5" opacity="0.08" />
        <circle cx="700" cy="180" r="3" fill="#4285F4" opacity="0.20" />
        <circle cx="750" cy="150" r="2.5" fill="#FBBC04" opacity="0.18" />
        <line x1="700" y1="180" x2="750" y2="150" stroke="#EA4335" strokeWidth="0.5" opacity="0.08" />
      </svg>
    ),
    2: (
      // 左から右へ水平寄りの上昇 + 交差
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 960 540">
        <line x1="-20" y1="440" x2="980" y2="80" stroke="#EA4335" strokeWidth="2" opacity="0.12" />
        <line x1="-20" y1="450" x2="980" y2="90" stroke="#EA4335" strokeWidth="0.8" opacity="0.06" />
        <line x1="-20" y1="380" x2="980" y2="140" stroke="#4285F4" strokeWidth="1.5" opacity="0.10" />
        <line x1="200" y1="560" x2="980" y2="200" stroke="#FBBC04" strokeWidth="2" opacity="0.12" />
        <line x1="500" y1="560" x2="960" y2="260" stroke="#34A853" strokeWidth="1.5" opacity="0.10" />
        {/* 交差ノード */}
        <circle cx="480" cy="260" r="3" fill="#EA4335" opacity="0.22" />
        <circle cx="600" cy="240" r="2.5" fill="#4285F4" opacity="0.18" />
        <circle cx="700" cy="300" r="3" fill="#FBBC04" opacity="0.20" />
        <line x1="480" y1="260" x2="600" y2="240" stroke="#34A853" strokeWidth="0.5" opacity="0.08" />
        <line x1="600" y1="240" x2="700" y2="300" stroke="#EA4335" strokeWidth="0.5" opacity="0.06" />
      </svg>
    ),
    3: (
      // 右下から左上へ（逆方向） + 右上からも
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 960 540">
        <line x1="980" y1="540" x2="200" y2="-20" stroke="#34A853" strokeWidth="2" opacity="0.12" />
        <line x1="980" y1="550" x2="210" y2="-10" stroke="#34A853" strokeWidth="0.8" opacity="0.06" />
        <line x1="980" y1="480" x2="350" y2="-20" stroke="#FBBC04" strokeWidth="2" opacity="0.12" />
        <line x1="980" y1="-20" x2="300" y2="560" stroke="#4285F4" strokeWidth="1.5" opacity="0.08" />
        <line x1="-20" y1="560" x2="500" y2="-20" stroke="#EA4335" strokeWidth="1.5" opacity="0.10" />
        {/* クロスノード */}
        <circle cx="550" cy="260" r="3.5" fill="#34A853" opacity="0.22" />
        <circle cx="480" cy="300" r="3" fill="#4285F4" opacity="0.18" />
        <circle cx="620" cy="220" r="2.5" fill="#FBBC04" opacity="0.20" />
        <line x1="480" y1="300" x2="550" y2="260" stroke="#EA4335" strokeWidth="0.5" opacity="0.08" />
        <line x1="550" y1="260" x2="620" y2="220" stroke="#34A853" strokeWidth="0.5" opacity="0.06" />
      </svg>
    ),
    4: (
      // 4本が中央上部の1点に集約（つながりの結実）
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 960 540">
        <line x1="-20" y1="540" x2="480" y2="60" stroke="#4285F4" strokeWidth="2.5" opacity="0.14" />
        <line x1="980" y1="540" x2="480" y2="60" stroke="#EA4335" strokeWidth="2.5" opacity="0.14" />
        <line x1="150" y1="560" x2="480" y2="60" stroke="#FBBC04" strokeWidth="2" opacity="0.12" />
        <line x1="810" y1="560" x2="480" y2="60" stroke="#34A853" strokeWidth="2" opacity="0.12" />
        {/* 集約点 */}
        <circle cx="480" cy="60" r="5" fill="#4285F4" opacity="0.20" />
        <circle cx="480" cy="60" r="3" fill="#FBBC04" opacity="0.15" />
        {/* 集約点から上への短いアクセント */}
        <line x1="480" y1="60" x2="460" y2="-20" stroke="#4285F4" strokeWidth="1.5" opacity="0.12" strokeLinecap="round" />
        <line x1="480" y1="60" x2="500" y2="-20" stroke="#EA4335" strokeWidth="1" opacity="0.10" strokeLinecap="round" />
      </svg>
    ),
  };

  return <>{patterns[variant]}</>;
}

function SlideHeader({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs tracking-wider mb-2" style={{ color: brand.textSub, letterSpacing: "0.08em" }}>
        {label}
      </p>
      <div className="flex gap-1 mb-3">
        <div className="w-3 h-0.5 rounded-full" style={{ background: "#4285F4" }} />
        <div className="w-3 h-0.5 rounded-full" style={{ background: "#EA4335" }} />
        <div className="w-3 h-0.5 rounded-full" style={{ background: "#FBBC04" }} />
        <div className="w-3 h-0.5 rounded-full" style={{ background: "#34A853" }} />
      </div>
      <h2
        className="text-xl sm:text-2xl font-bold"
        style={{ color: brand.primary, letterSpacing: "0.02em" }}
      >
        {title}
      </h2>
    </div>
  );
}

function SlideFooter({ companyName, slideNum, total }: { companyName: string; slideNum: number; total: number }) {
  return (
    <div className="absolute bottom-4 left-12 right-12 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Image src="/logo-adarch.png" alt="Ad Arch Group" width={80} height={20} className="h-3.5 w-auto opacity-30" />
        <span className="text-xs" style={{ color: "#D0CDC6" }}>|</span>
        <p className="text-xs" style={{ color: "#C0BDB5" }}>
          {companyName} 様 ご提案書
        </p>
      </div>
      <p className="text-xs" style={{ color: "#C0BDB5" }}>
        {slideNum} / {total}
      </p>
    </div>
  );
}
