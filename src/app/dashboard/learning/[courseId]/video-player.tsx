"use client";

import { useState } from "react";
import { Play } from "lucide-react";

function toEmbedUrl(url: string): string {
  // Google Drive: /file/d/{id}/view or /file/d/{id}/preview → embed URL
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }
  return url;
}

export function VideoPlayer({ url, title }: { url: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  const embedUrl = toEmbedUrl(url);

  if (!loaded) {
    return (
      <button
        onClick={() => setLoaded(true)}
        className="group relative w-full mt-2 aspect-video bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center cursor-pointer hover:bg-zinc-800 transition-colors"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
            <Play className="w-7 h-7 text-white ml-1" />
          </div>
          <span className="text-xs text-zinc-400">{title}</span>
        </div>
      </button>
    );
  }

  return (
    <div className="mt-2 aspect-video rounded-lg overflow-hidden bg-black">
      <iframe
        src={embedUrl}
        title={title}
        className="w-full h-full"
        allow="autoplay; encrypted-media"
        allowFullScreen
      />
    </div>
  );
}
