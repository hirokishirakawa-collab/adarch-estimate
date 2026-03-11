"use client";

import { X, Download, Loader2 } from "lucide-react";
import { useState } from "react";

interface ProposalContent {
  cover: { title: string; subtitle: string; date: string; to: string };
  companyIntro: { heading: string; description: string; strengths: string[] };
  proposal: { heading: string; challenge: string; solutions: { title: string; description: string }[] };
  cases: { heading: string; items: { title: string; description: string }[] };
  nextSteps: { heading: string; steps: string[]; contact: string };
}

interface ProposalPreviewProps {
  proposal: {
    id: string;
    companyName: string;
    content: ProposalContent;
  };
  onClose: () => void;
}

export function ProposalPreview({ proposal, onClose }: ProposalPreviewProps) {
  const [downloading, setDownloading] = useState(false);
  const c = proposal.content;

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      // Dynamic import to avoid SSR issues with react-pdf
      const { pdf } = await import("@react-pdf/renderer");
      const { ProposalPdfDocument } = await import("./proposal-pdf");
      const blob = await pdf(<ProposalPdfDocument content={c} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `提案書_${proposal.companyName}_${new Date().toISOString().split("T")[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF生成エラー:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <p className="text-sm font-bold text-zinc-800">{proposal.companyName} — 提案書プレビュー</p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* Cover */}
          <div className="text-center py-8 border-b border-zinc-200">
            <p className="text-xs text-zinc-400 mb-2">{c.cover.to}</p>
            <h1 className="text-2xl font-bold text-zinc-900 mb-1">{c.cover.title}</h1>
            <p className="text-sm text-zinc-500">{c.cover.subtitle}</p>
            <p className="text-xs text-zinc-400 mt-4">{c.cover.date}</p>
            <p className="text-xs text-zinc-400 mt-1">アドアーチグループ</p>
          </div>

          {/* Company Intro */}
          <div>
            <h2 className="text-lg font-bold text-zinc-800 mb-3">{c.companyIntro.heading}</h2>
            <p className="text-sm text-zinc-600 leading-relaxed mb-4">{c.companyIntro.description}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {c.companyIntro.strengths.map((s, i) => (
                <div key={i} className="bg-zinc-50 rounded-lg px-4 py-3 text-center">
                  <p className="text-sm font-medium text-zinc-700">{s}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Proposal */}
          <div>
            <h2 className="text-lg font-bold text-zinc-800 mb-3">{c.proposal.heading}</h2>
            <p className="text-sm text-zinc-600 mb-4 bg-zinc-50 rounded-lg px-4 py-3">{c.proposal.challenge}</p>
            <div className="space-y-3">
              {c.proposal.solutions.map((sol, i) => (
                <div key={i} className="border border-zinc-200 rounded-lg px-4 py-3">
                  <p className="text-sm font-semibold text-zinc-800 mb-1">{sol.title}</p>
                  <p className="text-sm text-zinc-600">{sol.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Cases */}
          <div>
            <h2 className="text-lg font-bold text-zinc-800 mb-3">{c.cases.heading}</h2>
            <div className="space-y-3">
              {c.cases.items.map((item, i) => (
                <div key={i} className="bg-zinc-50 rounded-lg px-4 py-3">
                  <p className="text-sm font-semibold text-zinc-700">{item.title}</p>
                  <p className="text-sm text-zinc-500 mt-1">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Next Steps */}
          <div>
            <h2 className="text-lg font-bold text-zinc-800 mb-3">{c.nextSteps.heading}</h2>
            <ol className="space-y-2 mb-4">
              {c.nextSteps.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-zinc-600">
                  <span className="w-6 h-6 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="text-sm text-zinc-500 text-center mt-6">{c.nextSteps.contact}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
