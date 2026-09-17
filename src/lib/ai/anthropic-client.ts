// ==============================================================
// Anthropic クライアントの共通入口 — 機能ごとのトークン使用量をログに残す
//   Console のコストは APIキー単位でしか見えないため、どの機能がクレジットを
//   使っているかを Railway のログで集計できるように 1呼び出し1行を出す。
//   形式: [ai-usage] {"feature":"tender-classify","model":"claude-sonnet-5","in":1200,"out":300,...}
//   本文・プロンプトは出さない（件数とトークン数だけ）
// ==============================================================

import Anthropic, { type ClientOptions } from "@anthropic-ai/sdk";

type Usage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

function logUsage(feature: string, model: string | undefined, usage: Usage) {
  console.log(
    `[ai-usage] ${JSON.stringify({
      feature,
      model: model ?? "unknown",
      in: usage.input_tokens ?? 0,
      out: usage.output_tokens ?? 0,
      cacheRead: usage.cache_read_input_tokens ?? 0,
      cacheWrite: usage.cache_creation_input_tokens ?? 0,
    })}`,
  );
}

// ストリーミング（SSE）は message_start に入力・モデル、message_delta に出力の累計が載る
async function readStreamUsage(feature: string, res: Response) {
  if (!res.body) return;
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  let model: string | undefined;
  const usage: Usage = {};
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += value;
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:") || !line.includes('"usage"')) continue;
      try {
        const ev = JSON.parse(line.slice(5));
        if (ev.type === "message_start") {
          model = ev.message?.model;
          Object.assign(usage, ev.message?.usage);
        } else if (ev.type === "message_delta" && ev.usage) {
          for (const [k, v] of Object.entries(ev.usage)) if (v != null) (usage as Record<string, unknown>)[k] = v;
        }
      } catch {
        // 壊れた行は無視（計測のために本処理を止めない）
      }
    }
  }
  logUsage(feature, model, usage);
}

function meteredFetch(feature: string): typeof fetch {
  return async (input, init) => {
    const res = await fetch(input, init);
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (res.ok && /\/v1\/messages(\?|$)/.test(url)) {
        const copy = res.clone();
        if ((res.headers.get("content-type") ?? "").includes("text/event-stream")) {
          void readStreamUsage(feature, copy).catch(() => {});
        } else {
          void copy
            .json()
            .then((j: { model?: string; usage?: Usage }) => j.usage && logUsage(feature, j.model, j.usage))
            .catch(() => {});
        }
      }
    } catch {
      // 計測の失敗は無視
    }
    return res;
  };
}

/** feature はログ集計用の機能名（例: "tender-classify"）。それ以外は new Anthropic() と同じ */
export function createAnthropic(feature: string, options: ClientOptions = {}): Anthropic {
  return new Anthropic({ ...options, fetch: meteredFetch(feature) });
}
