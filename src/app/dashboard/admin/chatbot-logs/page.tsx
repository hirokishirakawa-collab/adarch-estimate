"use client";

import { useEffect, useState } from "react";
import { MessageCircle, User, Clock } from "lucide-react";

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  user: { name: string | null; email: string | null };
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatbotLogsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/chatbot/history")
      .then((r) => {
        if (!r.ok) throw new Error("Forbidden");
        return r.json();
      })
      .then((d) => setConversations(d.conversations))
      .catch(() => setError("管理者権限が必要です"))
      .finally(() => setLoading(false));
  }, []);

  const selectedConv = conversations.find((c) => c.id === selected);

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-zinc-900">チャットボット履歴</h1>
          <p className="text-sm text-zinc-500">ユーザーのヘルプチャットボット利用履歴</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
      )}

      {loading && (
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-zinc-100 rounded-lg" />
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 会話一覧 */}
          <div className="lg:col-span-1 space-y-2 max-h-[70vh] overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-lg p-8 text-center">
                <p className="text-sm text-zinc-500">まだ会話がありません</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelected(conv.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selected === conv.id
                      ? "bg-blue-50 border-blue-200"
                      : "bg-white border-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-sm font-medium text-zinc-900 truncate">
                      {conv.user.name || conv.user.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(conv.updatedAt)}</span>
                    <span className="text-zinc-300">|</span>
                    <span>{conv.messages.length}件</span>
                  </div>
                  {conv.messages.length > 0 && (
                    <p className="text-xs text-zinc-500 mt-1 truncate">
                      {conv.messages[0].content}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>

          {/* 会話詳細 */}
          <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-lg overflow-hidden">
            {selectedConv ? (
              <>
                <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50">
                  <p className="text-sm font-medium text-zinc-900">
                    {selectedConv.user.name || selectedConv.user.email}
                  </p>
                  <p className="text-xs text-zinc-500">{formatDate(selectedConv.createdAt)}</p>
                </div>
                <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                  {selectedConv.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-blue-600 text-white rounded-br-md"
                            : "bg-zinc-100 text-zinc-800 rounded-bl-md"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-sm text-zinc-400">
                左の会話を選択してください
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
