"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Send, Loader2, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

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
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              <div>
                <span className="text-sm font-semibold">ヘルプアシスタント</span>
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
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Bot className="w-6 h-6 text-blue-500" />
                </div>
                <p className="text-sm font-medium text-zinc-700">使い方でお困りですか？</p>
                <p className="text-xs text-zinc-400 mt-1">何でもお気軽にご質問ください</p>
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
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-blue-600" />
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
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-blue-600" />
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

      {/* フローティングボタン */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105",
          open
            ? "bg-zinc-700 hover:bg-zinc-800"
            : "bg-blue-600 hover:bg-blue-700"
        )}
      >
        {open ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <MessageCircle className="w-5 h-5 text-white" />
        )}
      </button>
    </>
  );
}
