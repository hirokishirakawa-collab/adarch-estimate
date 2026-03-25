"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { X, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── アシスタントキャラクター SVG ──
function AssistantAvatar({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" className={className}>
      {/* 顔の丸 */}
      <circle cx="40" cy="40" r="36" fill="url(#avatar-gradient)" />
      {/* 目（左） */}
      <ellipse cx="30" cy="36" rx="4" ry="5" fill="#fff" />
      <ellipse cx="31" cy="37" rx="2" ry="2.5" fill="#1e3a5f" />
      {/* 目（右） */}
      <ellipse cx="50" cy="36" rx="4" ry="5" fill="#fff" />
      <ellipse cx="51" cy="37" rx="2" ry="2.5" fill="#1e3a5f" />
      {/* 口（笑顔） */}
      <path d="M32 48 Q40 56 48 48" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* ヘッドセット */}
      <path d="M16 36 Q16 16 40 16 Q64 16 64 36" stroke="#1e40af" strokeWidth="3" fill="none" />
      <rect x="12" y="32" width="8" height="12" rx="4" fill="#1e40af" />
      <rect x="60" y="32" width="8" height="12" rx="4" fill="#1e40af" />
      {/* マイク */}
      <line x1="12" y1="44" x2="12" y2="50" stroke="#1e40af" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="52" r="3" fill="#1e40af" />
      {/* グラデーション定義 */}
      <defs>
        <linearGradient id="avatar-gradient" x1="10" y1="10" x2="70" y2="70">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function AssistantAvatarSmall() {
  return (
    <svg width="24" height="24" viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="36" fill="url(#avatar-sm-gradient)" />
      <ellipse cx="30" cy="36" rx="4" ry="5" fill="#fff" />
      <ellipse cx="31" cy="37" rx="2" ry="2.5" fill="#1e3a5f" />
      <ellipse cx="50" cy="36" rx="4" ry="5" fill="#fff" />
      <ellipse cx="51" cy="37" rx="2" ry="2.5" fill="#1e3a5f" />
      <path d="M32 48 Q40 56 48 48" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <defs>
        <linearGradient id="avatar-sm-gradient" x1="10" y1="10" x2="70" y2="70">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

// ページ別サジェスト定義
const PAGE_SUGGESTIONS: Record<string, string[]> = {
  "/dashboard/estimates": [
    "見積もりの作り方を教えて",
    "PDFで出力するには？",
    "テンプレートの使い方は？",
  ],
  "/dashboard/proposals": [
    "提案書をAIで作るには？",
    "提案書をWeb公開したい",
    "閲覧分析はどこで見る？",
  ],
  "/dashboard/customers": [
    "新規顧客の登録方法は？",
    "先着ロックって何？",
    "顧客を検索したい",
  ],
  "/dashboard/deals": [
    "新しい商談を作りたい",
    "カンバン表示の切り替えは？",
    "商談ログの追加方法は？",
  ],
  "/dashboard/billing": [
    "請求依頼の出し方は？",
    "経費を自動で入れるには？",
    "申請後のフローは？",
  ],
  "/dashboard/business-cards": [
    "名刺を写真から登録したい",
    "名刺の検索方法は？",
    "コラボ希望フラグとは？",
  ],
  "/dashboard/projects": [
    "新規プロジェクトの作成方法は？",
    "Google Driveフォルダは自動で作られる？",
    "経費を登録したい",
  ],
  "/dashboard/leads": [
    "リード検索のやり方は？",
    "AIスコアリングとは？",
    "リードを顧客に転換したい",
  ],
  "/dashboard/wiki": [
    "Wiki記事の書き方は？",
    "記事を検索したい",
    "記事を編集するには？",
  ],
  "/dashboard/sales-insights": [
    "インサイトの投稿方法は？",
    "他拠点の営業情報を見たい",
  ],
  "/dashboard/cutsheet": [
    "カット表の作り方は？",
    "動画URLから自動生成できる？",
  ],
  "/dashboard/strategy-advisor": [
    "AIに広告戦略を相談したい",
    "予算の入れ方は？",
  ],
};

const DEFAULT_SUGGESTIONS = [
  "このシステムで何ができる？",
  "見積もりの作り方は？",
  "名刺を登録したい",
];

function getSuggestions(pathname: string): string[] {
  // 完全一致を先にチェック、次にプレフィックスマッチ
  if (PAGE_SUGGESTIONS[pathname]) return PAGE_SUGGESTIONS[pathname];
  for (const [path, suggestions] of Object.entries(PAGE_SUGGESTIONS)) {
    if (pathname.startsWith(path + "/")) return suggestions;
  }
  return DEFAULT_SUGGESTIONS;
}

// パスから日本語ページ名を取得
function getPageLabel(pathname: string): string {
  const map: Record<string, string> = {
    "/dashboard": "ダッシュボード",
    "/dashboard/estimates": "公式見積もり",
    "/dashboard/proposals": "提案書AI",
    "/dashboard/proposals/analytics": "提案書 閲覧分析",
    "/dashboard/customers": "顧客管理",
    "/dashboard/deals": "商談管理",
    "/dashboard/billing": "請求依頼",
    "/dashboard/business-cards": "名刺管理",
    "/dashboard/projects": "プロジェクト一覧",
    "/dashboard/leads": "リード獲得AI",
    "/dashboard/leads/btob": "BtoB リード",
    "/dashboard/leads/cinema": "シネアド リード",
    "/dashboard/leads/list": "リード管理",
    "/dashboard/wiki": "社内Wiki",
    "/dashboard/sales-insights": "営業インサイト共有",
    "/dashboard/cutsheet": "動画カット表AI",
    "/dashboard/strategy-advisor": "提案戦略アドバイザー",
    "/dashboard/video-achievements": "競合実績スクレイピング",
    "/dashboard/project-matching": "案件マッチング",
    "/dashboard/group-profiles": "メンバー紹介",
    "/dashboard/sales-report": "売上報告",
    "/dashboard/portfolio": "実績フォルダ検索",
    "/dashboard/tver-review": "TVer業態考査申請",
    "/dashboard/tver-campaign": "TVer配信申請",
    "/dashboard/tver-creative-review": "TVer クリエイティブ考査申請",
    "/dashboard/media": "媒体依頼",
    "/dashboard/tver-simulator": "TVer広告シミュレーター",
    "/dashboard/taxi-ads-simulator": "タクシー広告",
    "/dashboard/skylark-simulator": "すかいらーくインストア",
    "/dashboard/univ-coop-simulator": "大学生協広告",
    "/dashboard/aeon-cinema-simulator": "イオンシネマ",
    "/dashboard/golfcart-simulator": "ゴルフカート",
    "/dashboard/omochannel-simulator": "おもチャンネル",
    "/dashboard/admin/users": "メンバー管理",
    "/dashboard/login-logs": "操作ログ",
    "/dashboard/group-support": "グループサポート",
  };
  // 完全一致 → プレフィックスマッチ
  if (map[pathname]) return map[pathname];
  for (const [path, label] of Object.entries(map)) {
    if (pathname.startsWith(path + "/")) return label;
  }
  return "ダッシュボード";
}

export function ChatbotWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = useMemo(() => getSuggestions(pathname), [pathname]);
  const pageLabel = useMemo(() => getPageLabel(pathname), [pathname]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = text?.trim() || input.trim();
    if (!msg || loading) return;
    doSend(msg);
  };

  const doSend = async (text: string) => {
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId,
          currentPage: pathname,
          pageLabel,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        if (data.conversationId) setConversationId(data.conversationId);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error || "エラーが発生しました。" },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "通信エラーが発生しました。" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* チャットパネル */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-[360px] max-h-[520px] bg-white rounded-2xl shadow-2xl border border-zinc-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <div className="flex items-center gap-2.5">
              <AssistantAvatarSmall />
              <div>
                <span className="text-sm font-semibold">アーチくん</span>
                <span className="text-[10px] text-blue-200 ml-2">{pageLabel}</span>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-blue-700 rounded-md transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* メッセージエリア */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[300px] max-h-[360px]">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <div className="mx-auto mb-3">
                  <AssistantAvatar size={56} className="mx-auto" />
                </div>
                <p className="text-sm font-bold text-zinc-700">アーチくんです！</p>
                <p className="text-xs text-zinc-400 mt-1">使い方や機能のこと、なんでも聞いてください</p>
                <div className="mt-4 space-y-2">
                  {suggestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-zinc-50 hover:bg-zinc-100 text-zinc-600 transition-colors border border-zinc-100"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex items-start gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 mt-0.5">
                    <AssistantAvatarSmall />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-zinc-100 text-zinc-800 rounded-bl-md"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-start gap-2 justify-start">
                <div className="flex-shrink-0 mt-0.5">
                  <AssistantAvatarSmall />
                </div>
                <div className="bg-zinc-100 rounded-2xl rounded-bl-md px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                </div>
              </div>
            )}
          </div>

          {/* 入力エリア */}
          <div className="border-t border-zinc-100 px-3 py-2">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={"質問を入力...\n⌘+Enter で送信"}
                rows={3}
                className="flex-1 resize-none text-sm px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-24"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* フローティングボタン — キャラクター + 吹き出し */}
      <div className="fixed bottom-4 right-4 z-50 flex items-end gap-2">
        {/* 吹き出し（閉じている時のみ表示） */}
        {!open && (
          <div className="mb-2 bg-white rounded-xl shadow-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 animate-bounce-gentle relative">
            お困りですか？
            {/* 吹き出しの三角 */}
            <div className="absolute -right-1.5 bottom-2.5 w-3 h-3 bg-white border-r border-b border-zinc-200 rotate-[-45deg]" />
          </div>
        )}
        <button
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            "rounded-full shadow-lg shadow-blue-500/25 transition-all duration-200 hover:scale-110 hover:shadow-xl hover:shadow-blue-500/40",
            open ? "bg-zinc-700 hover:bg-zinc-800 w-12 h-12 flex items-center justify-center" : ""
          )}
        >
          {open ? (
            <X className="w-5 h-5 text-white" />
          ) : (
            <AssistantAvatar size={52} />
          )}
        </button>
      </div>
    </>
  );
}
