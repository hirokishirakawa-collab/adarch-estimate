"use client";

import { useState, useCallback } from "react";
import { VideoPlayer } from "./video-player";
import { ChangeList, getChangeColor } from "./change-list";
import { NotePanel } from "./note-panel";
import { ApprovalBar } from "./approval-bar";
import { DiffOverlay } from "./diff-overlay";
import { AnalysisProgress } from "./analysis-progress";

interface Change {
  id: string;
  type: string;
  timecodeIn: number;
  timecodeOut: number | null;
  description: string;
  confidence: number;
  beforeFramePath: string | null;
  afterFramePath: string | null;
  diffFramePath: string | null;
}

interface Note {
  id: string;
  timecode: number;
  text: string;
  author: string;
  createdAt: string;
}

interface Props {
  review: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    beforeVideoUrl: string;
    afterVideoUrl: string;
    afterDuration: number;
    totalChanges: number;
    approvedBy: string | null;
    rejectedBy: string | null;
    rejectionNote: string | null;
    staffName: string;
    createdAt: string;
  };
  changes: Change[];
  notes: Note[];
}

export function ReviewViewer({ review, changes, notes }: Props) {
  const [currentTime, setCurrentTime] = useState(0);
  const [seekTo, setSeekTo] = useState<number | null>(null);
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const [diffChange, setDiffChange] = useState<Change | null>(null);
  const [analysisComplete, setAnalysisComplete] = useState(
    review.status !== "UPLOADING" && review.status !== "ANALYZING"
  );

  const handleSeek = useCallback((timecode: number) => {
    setSeekTo(timecode);
    // Reset seekTo after a tick so it can be re-triggered
    setTimeout(() => setSeekTo(null), 100);
  }, []);

  const handleViewDiff = useCallback(
    (changeId: string) => {
      const change = changes.find((c) => c.id === changeId);
      if (change) setDiffChange(change);
    },
    [changes]
  );

  const changeTimecodes = changes.map((c) => c.timecodeIn);
  const changeColors = changes.map((c) => getChangeColor(c.type));

  // Show analysis progress if still processing
  if (!analysisComplete) {
    return (
      <div className="max-w-2xl mx-auto">
        <AnalysisProgress
          reviewId={review.id}
          initialStatus={review.status}
          onComplete={() => {
            setAnalysisComplete(true);
            window.location.reload();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white/90">{review.title}</h1>
          {review.description && (
            <p className="text-sm text-white/50 mt-1">{review.description}</p>
          )}
          <p className="text-xs text-white/30 mt-1">
            {review.staffName} ・ {new Date(review.createdAt).toLocaleDateString("ja-JP")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
            {review.totalChanges} 件の変更
          </span>
        </div>
      </div>

      {/* Video Player */}
      <VideoPlayer
        beforeVideoUrl={review.beforeVideoUrl}
        afterVideoUrl={review.afterVideoUrl}
        changeTimecodes={changeTimecodes}
        changeColors={changeColors}
        duration={review.afterDuration}
        onTimeUpdate={setCurrentTime}
        seekTo={seekTo}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Change List - 2 columns */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-white/70">
            変更検出一覧
          </h3>
          <div className="rounded-xl bg-white/[0.02] border border-white/5 p-2 max-h-80 overflow-y-auto">
            <ChangeList
              changes={changes}
              onSeek={handleSeek}
              onViewDiff={handleViewDiff}
              selectedChangeId={selectedChangeId}
            />
          </div>
        </div>

        {/* Notes + Approval - 1 column */}
        <div className="space-y-6">
          <NotePanel
            reviewId={review.id}
            notes={notes}
            currentTime={currentTime}
            onSeek={handleSeek}
          />

          <ApprovalBar
            reviewId={review.id}
            currentStatus={review.status}
            approvedBy={review.approvedBy}
            rejectedBy={review.rejectedBy}
            rejectionNote={review.rejectionNote}
          />
        </div>
      </div>

      {/* Diff Overlay */}
      {diffChange && (
        <DiffOverlay
          changeId={diffChange.id}
          beforeFramePath={diffChange.beforeFramePath}
          afterFramePath={diffChange.afterFramePath}
          diffFramePath={diffChange.diffFramePath}
          description={diffChange.description}
          onClose={() => setDiffChange(null)}
        />
      )}
    </div>
  );
}
