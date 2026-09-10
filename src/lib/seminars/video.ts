/** 動画URL → 埋め込み情報。YouTube（youtu.be / watch?v= / live / shorts / embed）と Vimeo に対応。他はリンクだけ */
export type EmbedInfo = { kind: "youtube" | "vimeo" | "link"; embedUrl: string | null; watchUrl: string };

export function parseVideoUrl(raw: string): EmbedInfo {
  const url = raw.trim();
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return { kind: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`, watchUrl: url };
    }
    if (host === "youtube.com") {
      const v = u.searchParams.get("v");
      const seg = u.pathname.split("/").filter(Boolean);
      const id = v ?? ((seg[0] === "live" || seg[0] === "shorts" || seg[0] === "embed") ? seg[1] : null);
      if (id) return { kind: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`, watchUrl: url };
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean).find((s) => /^\d+$/.test(s));
      if (id) return { kind: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}`, watchUrl: url };
    }
  } catch {
    /* 不正URL */
  }
  return { kind: "link", embedUrl: null, watchUrl: url };
}

export function isValidVideoUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:";
  } catch {
    return false;
  }
}
