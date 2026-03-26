"use client";

import { useState, useActionState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { approveReview, rejectReview } from "@/lib/actions/review";

interface Props {
  reviewId: string;
  currentStatus: string;
  approvedBy?: string | null;
  rejectedBy?: string | null;
  rejectionNote?: string | null;
}

export function ApprovalBar({
  reviewId,
  currentStatus,
  approvedBy,
  rejectedBy,
  rejectionNote,
}: Props) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejectState, rejectAction, isRejecting] = useActionState(rejectReview, null);

  if (currentStatus === "APPROVED") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        <div>
          <p className="text-sm font-medium text-emerald-400">承認済み</p>
          {approvedBy && (
            <p className="text-xs text-emerald-400/50">{approvedBy} が承認</p>
          )}
        </div>
      </div>
    );
  }

  if (currentStatus === "REJECTED") {
    return (
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/20">
        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-red-400">差し戻し</p>
          {rejectedBy && (
            <p className="text-xs text-red-400/50">{rejectedBy} が差し戻し</p>
          )}
          {rejectionNote && (
            <p className="text-xs text-red-400/70 mt-1">{rejectionNote}</p>
          )}
        </div>
      </div>
    );
  }

  const handleApprove = async () => {
    setApproving(true);
    await approveReview(reviewId);
    setApproving(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <button
          onClick={handleApprove}
          disabled={approving}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600/15 text-emerald-400 border border-emerald-500/20 font-semibold text-sm hover:bg-emerald-600/25 disabled:opacity-40 transition-all"
        >
          {approving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          OK（承認）
        </button>
        <button
          onClick={() => setShowRejectForm(!showRejectForm)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600/10 text-red-400 border border-red-500/20 font-semibold text-sm hover:bg-red-600/20 transition-all"
        >
          <XCircle className="w-4 h-4" />
          差し戻し
        </button>
      </div>

      {showRejectForm && (
        <form action={rejectAction} className="space-y-2">
          <input type="hidden" name="reviewId" value={reviewId} />
          <textarea
            name="note"
            rows={2}
            placeholder="差し戻し理由（任意）"
            className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white/90 text-sm placeholder:text-white/30 focus:border-red-500/40 focus:outline-none transition-colors resize-none"
          />
          {rejectState?.error && (
            <p className="text-red-400 text-xs">{rejectState.error}</p>
          )}
          <button
            type="submit"
            disabled={isRejecting}
            className="w-full py-2 rounded-lg bg-red-600/20 text-red-400 border border-red-500/20 text-sm font-medium hover:bg-red-600/30 disabled:opacity-40 transition-colors"
          >
            {isRejecting ? "送信中..." : "差し戻しを確定"}
          </button>
        </form>
      )}
    </div>
  );
}
