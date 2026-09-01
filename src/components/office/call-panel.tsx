"use client";
// ==============================================================
// 5分の音声パネル（右下フローティング）
//   ・入った瞬間はマイクだけ。カメラは押した時だけ
//   ・残り時間を常に表示、0で必ず切れる（延長ボタンは置かない）
//   ・呼びかけ側は 60秒 相手が入らなければ諦める
// ==============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  TrackToggle,
  VideoTrack,
  useParticipants,
  useTracks,
  useConnectionState,
} from "@livekit/components-react";
import { Track, ConnectionState } from "livekit-client";
import { Mic, Video, PhoneOff } from "lucide-react";

export interface CallSession {
  room: string;
  url: string;
  token: string;
  expiresAt: string;
  peerName: string;
  peerId: string;
  peerIsHq: boolean;
  role: "caller" | "callee";
}

export type CallEndReason = "hangup" | "expired" | "noanswer" | "peer" | "error";

const RING_MS = 60_000;

export function CallPanel({ call, onEnd }: { call: CallSession; onEnd: (reason: CallEndReason) => void }) {
  const [left, setLeft] = useState(() => Math.max(0, Date.parse(call.expiresAt) - Date.now()));

  // 残り時間。0になったら必ず切る
  useEffect(() => {
    const t = setInterval(() => {
      const ms = Math.max(0, Date.parse(call.expiresAt) - Date.now());
      setLeft(ms);
      if (ms <= 0) {
        clearInterval(t);
        onEnd("expired");
      }
    }, 500);
    return () => clearInterval(t);
  }, [call.expiresAt, onEnd]);

  const mm = Math.floor(left / 60_000);
  const ss = Math.floor((left % 60_000) / 1000);
  const urgent = left <= 60_000;

  return (
    <div className="fixed bottom-4 right-4 z-[70] w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-zinc-800 bg-[#0d1119] text-zinc-100 shadow-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        <span className="text-[12px] font-semibold truncate">{call.peerName || "相手"} さんと</span>
        <span
          className={`ml-auto font-mono text-[13px] tabular-nums ${urgent ? "text-rose-300" : "text-zinc-300"}`}
          title="この時間で必ず切れます"
        >
          {mm}:{String(ss).padStart(2, "0")}
        </span>
      </div>

      <LiveKitRoom
        serverUrl={call.url}
        token={call.token}
        connect
        audio
        video={false}
        onDisconnected={() => onEnd("peer")}
        onError={(e) => {
          console.error("[office:call]", e);
          onEnd("error");
        }}
        className="p-3"
      >
        <RoomAudioRenderer />
        <Inside call={call} onEnd={onEnd} urgent={urgent} />
      </LiveKitRoom>
    </div>
  );
}

function Inside({ call, onEnd, urgent }: { call: CallSession; onEnd: (r: CallEndReason) => void; urgent: boolean }) {
  const participants = useParticipants();
  const state = useConnectionState();
  const remote = participants.filter((p) => !p.isLocal);
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const videoTracks = useMemo(() => tracks.filter((t) => t.publication && !t.publication.isMuted), [tracks]);
  const joined = useRef(false); // 相手が一度でも入ったか

  // 相手が入った→記録／入っていた相手が消えた→終わり（部屋は2人まで）
  useEffect(() => {
    if (remote.length > 0) {
      joined.current = true;
      return;
    }
    if (joined.current) onEnd("peer");
  }, [remote.length, onEnd]);

  // 呼びかけ側: 60秒で相手が来なければ諦める
  useEffect(() => {
    if (call.role !== "caller") return;
    const t = setTimeout(() => {
      if (!joined.current) onEnd("noanswer");
    }, RING_MS);
    return () => clearTimeout(t);
  }, [call.role, onEnd]);

  const connecting = state !== ConnectionState.Connected;

  return (
    <div>
      {videoTracks.length > 0 && (
        <div className={`grid gap-2 mb-3 ${videoTracks.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {videoTracks.map((t) => (
            <div key={t.participant.identity + t.source} className="relative aspect-video rounded-lg overflow-hidden bg-black">
              <VideoTrack trackRef={t} className="w-full h-full object-cover" />
              <span className="absolute bottom-1 left-1.5 text-[10px] bg-black/50 px-1 rounded">
                {t.participant.isLocal ? "自分" : t.participant.name || "相手"}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-zinc-400 mb-3 min-h-[1rem]">
        {connecting
          ? "接続中…（マイクの許可を求められたら「許可」を押してください）"
          : remote.length === 0
            ? call.role === "caller"
              ? "相手が入るのを待っています…（60秒）"
              : "相手を待っています…"
            : urgent
              ? "残り1分です。続きは予約で"
              : `${call.peerName || "相手"} さんと繋がっています`}
      </p>

      <div className="flex items-center gap-2">
        <TrackToggle
          source={Track.Source.Microphone}
          showIcon={false}
          className="lk-mic flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] bg-white/10 hover:bg-white/15 data-[lk-enabled=false]:bg-rose-500/30"
        >
          <Mic className="w-4 h-4" />
          マイク
        </TrackToggle>
        <TrackToggle
          source={Track.Source.Camera}
          initialState={false}
          showIcon={false}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] bg-white/10 hover:bg-white/15 data-[lk-enabled=true]:bg-sky-500/40"
        >
          <Video className="w-4 h-4" />
          カメラ
        </TrackToggle>
        <button
          type="button"
          onClick={() => onEnd("hangup")}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] bg-rose-600 hover:bg-rose-500"
        >
          <PhoneOff className="w-4 h-4" />
          終了
        </button>
      </div>
    </div>
  );
}
