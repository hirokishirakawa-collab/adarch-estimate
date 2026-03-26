"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, SkipBack, Volume2, VolumeX } from "lucide-react";

interface Props {
  beforeVideoUrl: string;
  afterVideoUrl: string;
  changeTimecodes: number[];
  changeColors: string[];
  duration: number;
  onTimeUpdate?: (time: number) => void;
  seekTo?: number | null;
}

export function VideoPlayer({
  beforeVideoUrl,
  afterVideoUrl,
  changeTimecodes,
  changeColors,
  duration,
  onTimeUpdate,
  seekTo,
}: Props) {
  const beforeRef = useRef<HTMLVideoElement>(null);
  const afterRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const syncing = useRef(false);

  // Sync playback
  const syncVideos = useCallback(() => {
    if (syncing.current) return;
    syncing.current = true;

    const after = afterRef.current;
    const before = beforeRef.current;
    if (after && before) {
      const time = after.currentTime;
      if (Math.abs(before.currentTime - time) > 0.15) {
        before.currentTime = time;
      }
      setCurrentTime(time);
      onTimeUpdate?.(time);
    }

    syncing.current = false;
  }, [onTimeUpdate]);

  useEffect(() => {
    const after = afterRef.current;
    if (!after) return;
    after.addEventListener("timeupdate", syncVideos);
    return () => after.removeEventListener("timeupdate", syncVideos);
  }, [syncVideos]);

  // Seek from parent
  useEffect(() => {
    if (seekTo === null || seekTo === undefined) return;
    const before = beforeRef.current;
    const after = afterRef.current;
    if (before) before.currentTime = seekTo;
    if (after) after.currentTime = seekTo;
    setCurrentTime(seekTo);
  }, [seekTo]);

  const togglePlay = () => {
    const before = beforeRef.current;
    const after = afterRef.current;
    if (!before || !after) return;

    if (isPlaying) {
      before.pause();
      after.pause();
    } else {
      before.play();
      after.play();
    }
    setIsPlaying(!isPlaying);
  };

  const seekToStart = () => {
    const before = beforeRef.current;
    const after = afterRef.current;
    if (before) before.currentTime = 0;
    if (after) after.currentTime = 0;
    setCurrentTime(0);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const time = ratio * duration;

    const before = beforeRef.current;
    const after = afterRef.current;
    if (before) before.currentTime = time;
    if (after) after.currentTime = time;
    setCurrentTime(time);
  };

  const toggleMute = () => {
    const after = afterRef.current;
    if (after) after.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-3">
      {/* Video pair */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-white/40 mb-1 font-medium uppercase tracking-wider">
            修正前
          </p>
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
            <video
              ref={beforeRef}
              src={beforeVideoUrl}
              muted
              playsInline
              preload="metadata"
              className="w-full h-full object-contain"
            />
          </div>
        </div>
        <div>
          <p className="text-xs text-white/40 mb-1 font-medium uppercase tracking-wider">
            修正後
          </p>
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
            <video
              ref={afterRef}
              src={afterVideoUrl}
              muted={isMuted}
              playsInline
              preload="metadata"
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-1">
        <div
          className="relative h-8 bg-white/[0.04] rounded-lg cursor-pointer group"
          onClick={handleTimelineClick}
        >
          {/* Progress bar */}
          <div
            className="absolute top-0 left-0 h-full bg-amber-500/15 rounded-lg transition-all"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
          {/* Playhead */}
          <div
            className="absolute top-0 w-0.5 h-full bg-amber-500 z-10"
            style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
          {/* Change dots */}
          {changeTimecodes.map((tc, i) => (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full z-20 border border-black/40"
              style={{
                left: `${duration > 0 ? (tc / duration) * 100 : 0}%`,
                backgroundColor: changeColors[i] || "#ef4444",
              }}
              title={formatTime(tc)}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 text-white/60">
          <button
            onClick={seekToStart}
            className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={togglePlay}
            className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={toggleMute}
            className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <span className="text-xs font-mono text-white/50 ml-auto">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
