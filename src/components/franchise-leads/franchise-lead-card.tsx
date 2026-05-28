"use client";

import { useState } from "react";
import {
  ExternalLink,
  Phone,
  Globe,
  MapPin,
  Star,
  ChevronDown,
  ChevronUp,
  Trash2,
  Loader2,
  Mail,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FranchiseLeadData } from "./franchise-pipeline";

interface FranchiseLeadCardProps {
  lead: FranchiseLeadData;
  stages: Array<{ key: string; label: string; color: string }>;
  onUpdate: (id: string, updates: Partial<FranchiseLeadData>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function FranchiseLeadCard({
  lead,
  stages,
  onUpdate,
  onDelete,
}: FranchiseLeadCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [nextAction, setNextAction] = useState(lead.nextAction ?? "");
  const [nextActionDate, setNextActionDate] = useState(
    lead.nextActionDate ? lead.nextActionDate.split("T")[0] : ""
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [email, setEmail] = useState(lead.email ?? "");
  const [emailSubject, setEmailSubject] = useState(lead.emailSubject ?? "");
  const [emailBody, setEmailBody] = useState(lead.emailBody ?? "");
  const [generating, setGenerating] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const getPriorityBadge = (score: number | null) => {
    if (!score) return null;
    if (score >= 75) return { label: "S", color: "bg-red-100 text-red-700" };
    if (score >= 60) return { label: "A", color: "bg-orange-100 text-orange-700" };
    if (score >= 40) return { label: "B", color: "bg-yellow-100 text-yellow-700" };
    return { label: "C", color: "bg-zinc-100 text-zinc-600" };
  };

  const priorityBadge = getPriorityBadge(lead.scoreTotal);

  const handleStatusChange = async (newStatus: string) => {
    await onUpdate(lead.id, { status: newStatus } as Partial<FranchiseLeadData>);
  };

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      await onUpdate(lead.id, {
        notes: notes || null,
        nextAction: nextAction || null,
        nextActionDate: nextActionDate || null,
        email: email || null,
        emailSubject: emailSubject || null,
        emailBody: emailBody || null,
      } as Partial<FranchiseLeadData>);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateDraft = async () => {
    setGenerating(true);
    setDraftError(null);
    try {
      const res = await fetch("/api/franchise-leads/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          companyName: lead.companyName,
          address: lead.address,
          businessType: lead.businessType ?? "",
          website: lead.website ?? undefined,
          scoreComment: lead.scoreComment ?? undefined,
          scoreTotal: lead.scoreTotal ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDraftError(data.error ?? "生成に失敗しました");
        return;
      }
      setEmailSubject(data.subject);
      setEmailBody(data.body);
    } catch {
      setDraftError("生成に失敗しました。通信状況を確認してください。");
    } finally {
      setGenerating(false);
    }
  };

  const openInGmail = () => {
    const params = new URLSearchParams({ view: "cm", fs: "1" });
    if (email) params.set("to", email);
    if (emailSubject) params.set("su", emailSubject);
    if (emailBody) params.set("body", emailBody);
    window.open(
      `https://mail.google.com/mail/?${params.toString()}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(lead.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-zinc-200 shadow-sm">
      {/* ヘッダー */}
      <div
        className="px-3 py-2.5 cursor-pointer hover:bg-zinc-50/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-zinc-900 truncate">{lead.companyName}</p>
            {lead.businessType && (
              <p className="text-[10px] text-zinc-400 truncate mt-0.5">{lead.businessType}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {priorityBadge && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${priorityBadge.color}`}>
                {priorityBadge.label}
              </span>
            )}
            {lead.scoreTotal != null && (
              <span className="text-[10px] font-medium text-zinc-500">{lead.scoreTotal}pt</span>
            )}
            {isExpanded ? (
              <ChevronUp className="w-3 h-3 text-zinc-400" />
            ) : (
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            )}
          </div>
        </div>

        {/* コンパクト情報 */}
        <div className="flex items-center gap-2 mt-1.5">
          {lead.prefecture && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-500">
              <MapPin className="w-2.5 h-2.5" />
              {lead.prefecture}
            </span>
          )}
          {lead.rating != null && lead.rating > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-500">
              <Star className="w-2.5 h-2.5 text-amber-400" />
              {lead.rating}
            </span>
          )}
          {lead.hasWebsite && (
            <span className="inline-flex items-center text-[10px] text-zinc-400">
              <Globe className="w-2.5 h-2.5" />
            </span>
          )}
          {lead.nextAction && (
            <span className="text-[10px] text-blue-600 truncate">
              → {lead.nextAction}
            </span>
          )}
        </div>
      </div>

      {/* 展開パネル */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-zinc-100 space-y-3">
          {/* ステータス変更 */}
          <div>
            <p className="text-[10px] text-zinc-500 mb-1">ステータス</p>
            <select
              value={lead.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full border border-zinc-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {stages.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* スコアコメント */}
          {lead.scoreComment && (
            <div>
              <p className="text-[10px] text-zinc-500 mb-1">AIコメント</p>
              <p className="text-[11px] text-zinc-600 bg-zinc-50 rounded-md p-2">{lead.scoreComment}</p>
            </div>
          )}

          {/* 連絡先 */}
          <div className="flex flex-wrap gap-2">
            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
              >
                <Phone className="w-3 h-3" /> {lead.phone}
              </a>
            )}
            {lead.website && (
              <a
                href={lead.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> Web
              </a>
            )}
            {lead.googleMapsUrl && (
              <a
                href={lead.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
              >
                <MapPin className="w-3 h-3" /> Maps
              </a>
            )}
          </div>

          {/* メモ */}
          <div>
            <p className="text-[10px] text-zinc-500 mb-1">メモ</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-zinc-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              placeholder="自由メモ..."
            />
          </div>

          {/* 次回アクション */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-zinc-500 mb-1">次回アクション</p>
              <input
                type="text"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                className="w-full border border-zinc-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="例: 電話する"
              />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 mb-1">期日</p>
              <input
                type="date"
                value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)}
                className="w-full border border-zinc-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* 営業メール下書き（コックピット） */}
          <div className="border-t border-zinc-100 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-zinc-600 flex items-center gap-1">
                <Mail className="w-3 h-3" /> 営業メール下書き
              </p>
              {lead.emailDraftedAt && (
                <span className="text-[9px] text-zinc-400">生成済</span>
              )}
            </div>

            <div>
              <p className="text-[10px] text-zinc-500 mb-1">宛先メール（任意）</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-zinc-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="例: info@example.co.jp"
              />
            </div>

            <Button
              size="xs"
              variant="outline"
              onClick={handleGenerateDraft}
              disabled={generating}
              className="gap-1 w-full"
            >
              {generating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              {emailBody ? "下書きを再生成" : "AIで下書きを生成"}
            </Button>
            {draftError && <p className="text-[10px] text-red-600">{draftError}</p>}

            {(emailSubject || emailBody) && (
              <>
                <div>
                  <p className="text-[10px] text-zinc-500 mb-1">件名</p>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full border border-zinc-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 mb-1">本文</p>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={10}
                    className="w-full border border-zinc-300 rounded-md px-2 py-1.5 text-[11px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
                  />
                </div>
                <Button
                  size="xs"
                  variant="default"
                  onClick={openInGmail}
                  className="gap-1 w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  <ExternalLink className="w-3 h-3" /> Gmailで下書きを開く
                </Button>
                <p className="text-[9px] text-zinc-400 leading-snug">
                  Gmailの作成画面が件名・本文入りで開きます。内容を確認し、送信・下書き保存はご自身で行ってください。編集した内容は「保存」で記録されます。
                </p>
              </>
            )}
          </div>

          {/* アクションボタン */}
          <div className="flex items-center justify-between pt-1">
            <Button
              size="xs"
              variant="default"
              onClick={handleSaveDetails}
              disabled={saving}
              className="gap-1"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              保存
            </Button>

            {confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-red-600">本当に削除?</span>
                <Button
                  size="xs"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="gap-1"
                >
                  {deleting && <Loader2 className="w-3 h-3 animate-spin" />}
                  削除
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setConfirmDelete(false)}
                >
                  取消
                </Button>
              </div>
            ) : (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                className="text-zinc-400 hover:text-red-500"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
