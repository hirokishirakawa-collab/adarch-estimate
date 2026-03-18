"use client";

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
    <div className="fixed inset-0 z-50 bg-black/80">
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
          onClose={onClose}
        />
      </div>
    </div>
  );
}
