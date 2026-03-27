"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import MuxPlayer from "@mux/mux-player-react";
import { Play, Pause, SkipBack } from "lucide-react";

interface Props {
  beforeVideoUrl: string;
  afterVideoUrl: string;
  changeTimecodes: number[];
  changeColors: string[];
  duration: number;
  onTimeUpdate?: (time: number) => void;
  seekTo?: number | null;
}

// playbackId を URL から抽出
function extractPlaybackId(url: string): string | null {
  // https://stream.mux.com/XXXXX.m3u8
  const match = url.match(/stream\.mux\.com\/([^/.]+)/);
  return match?.[1] ?? null;
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
  const beforeRef = useRef<HTMLMediaElement | null>(null);
  const afterRef = useRef<HTMLMediaElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const syncing = useRef(false);

  const beforePlaybackId = extractPlaybackId(beforeVideoUrl);
  const afterPlaybackId = extractPlaybackId(afterVideoUrl);
  const isMux = !!beforePlaybackId && !!afterPlaybackId;

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

  // Seek from parent
  useEffect(() => {
    if (seekTo === null || seekTo === undefined) return;
    if (beforeRef.current) beforeRef.current.currentTime = seekTo;
    if (afterRef.current) afterRef.current.currentTime = seekTo;
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
    if (beforeRef.current) beforeRef.current.currentTime = 0;
    if (afterRef.current) afterRef.current.currentTime = 0;
    setCurrentTime(0);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const time = ratio * duration;

    if (beforeRef.current) beforeRef.current.currentTime = time;
    if (afterRef.current) afterRef.current.currentTime = time;
    setCurrentTime(time);
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
          <p className="text-xs text-zinc-500 mb-1 font-medium uppercase tracking-wider">修正前</p>
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
            {isMux ? (
              <MuxPlayer
                playbackId={beforePlaybackId!}
                muted
                style={{ width: "100%", height: "100%", ["--controls" as string]: "none" }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ref={(el: any) => {
                  if (el?.media?.nativeEl) beforeRef.current = el.media.nativeEl;
                  else if (el instanceof HTMLMediaElement) beforeRef.current = el;
                }}
              />
            ) : (
              <video ref={beforeRef as React.RefObject<HTMLVideoElement>} src={beforeVideoUrl} muted playsInline preload="metadata" className="w-full h-full object-contain" />
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-zinc-500 mb-1 font-medium uppercase tracking-wider">修正後</p>
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
            {isMux ? (
              <MuxPlayer
                playbackId={afterPlaybackId!}
                muted
                style={{ width: "100%", height: "100%", ["--controls" as string]: "none" }}
                onTimeUpdate={syncVideos}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ref={(el: any) => {
                  if (el?.media?.nativeEl) afterRef.current = el.media.nativeEl;
                  else if (el instanceof HTMLMediaElement) afterRef.current = el;
                }}
              />
            ) : (
              <video ref={afterRef as React.RefObject<HTMLVideoElement>} src={afterVideoUrl} muted playsInline preload="metadata" className="w-full h-full object-contain" onTimeUpdate={syncVideos} />
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-1">
        <div className="relative h-8 bg-zinc-900 rounded-lg cursor-pointer group" onClick={handleTimelineClick}>
          <div
            className="absolute top-0 left-0 h-full bg-white/5 rounded-lg transition-all"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
          <div
            className="absolute top-0 w-0.5 h-full bg-white z-10"
            style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
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

        <div className="flex items-center gap-3 text-zinc-500">
          <button onClick={seekToStart} className="p-1.5 rounded-md hover:bg-zinc-900 hover:text-white transition-colors">
            <SkipBack className="w-4 h-4" />
          </button>
          <button onClick={togglePlay} className="p-1.5 rounded-md hover:bg-zinc-900 hover:text-white transition-colors">
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <span className="text-xs font-mono text-zinc-600 ml-auto">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
