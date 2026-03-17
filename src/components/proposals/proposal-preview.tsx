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
      {/* 閉じるボタン */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
      >
        <X className="w-5 h-5 text-white" />
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
