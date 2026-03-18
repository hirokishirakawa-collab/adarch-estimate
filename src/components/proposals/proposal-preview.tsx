"use client";

import { X } from "lucide-react";
import { PublicProposalView } from "./public-proposal-view";

interface ProposalPreviewProps {
  proposal: {
    id: string;
    companyName: string;
    content: any;
  };
  onClose: () => void;
}

export function ProposalPreview({ proposal, onClose }: ProposalPreviewProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      {/* 閉じるボタン — PDFボタンの右横に配置 */}
      <button
        onClick={onClose}
        className="absolute top-[11px] right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-red-500 hover:bg-red-600 text-white transition-colors shadow-sm"
      >
        <X className="w-3.5 h-3.5" />
        閉じる
      </button>

      {/* スライドビュー */}
      <div className="w-full h-full">
        <PublicProposalView
          proposal={{
            id: proposal.id,
            companyName: proposal.companyName,
            title: null,
            content: proposal.content,
            isPublished: false,
            publishedAt: null,
          }}
          slug="preview"
          preview
        />
      </div>
    </div>
  );
}
