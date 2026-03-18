"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = text?.trim() || input.trim();
    if (!msg || loading) return;
    send(msg);
  };

  const send = async (text: string) => {
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId }),
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
    if (e.key === "Enter" && !e.shiftKey) {
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
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm font-semibold">ヘルプアシスタント</span>
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
                  <MessageCircle className="w-6 h-6 text-blue-500" />
                </div>
                <p className="text-sm font-medium text-zinc-700">使い方でお困りですか？</p>
                <p className="text-xs text-zinc-400 mt-1">何でもお気軽にご質問ください</p>
                <div className="mt-4 space-y-2">
                  {["見積もりの作り方は？", "提案書の公開方法は？", "名刺を登録したい"].map((q) => (
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
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap",
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
              <div className="flex justify-start">
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
                placeholder="質問を入力..."
                rows={1}
                className="flex-1 resize-none text-sm px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-20"
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
