"use client";

import { cn } from "@/lib/utils";

interface AuditLog {
  id: string;
  action: string;
  email: string;
  name: string | null;
  entity: string | null;
  entityId: string | null;
  detail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

interface Props {
  logs: AuditLog[];
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function shortenUA(ua: string | null): string {
  if (!ua) return "-";
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  return ua.slice(0, 30) + (ua.length > 30 ? "..." : "");
}

// アクション名の日本語ラベル
const ACTION_LABELS: Record<string, string> = {
  login_success: "ログイン成功",
  login_failed: "ログイン失敗",
  customer_created: "顧客作成",
  customer_updated: "顧客更新",
  customer_deleted: "顧客削除",
  deal_created: "商談作成",
  deal_updated: "商談更新",
  deal_status_updated: "商談ステータス変更",
  deal_deleted: "商談削除",
  project_created: "プロジェクト作成",
  project_updated: "プロジェクト更新",
  expense_created: "経費追加",
  expense_deleted: "経費削除",
  estimation_created: "見積書作成",
  estimation_deleted: "見積書削除",
  estimation_status_updated: "見積ステータス変更",
  member_registered: "メンバー登録",
  user_updated: "ユーザー更新",
  user_deleted: "ユーザー削除",
  user_role_updated: "ロール変更",
  invoice_created: "請求依頼作成",
  invoice_updated: "請求依頼更新",
  invoice_deleted: "請求依頼削除",
  media_request_created: "媒体依頼作成",
  media_request_status_updated: "媒体依頼ステータス変更",
  collaboration_created: "連携依頼作成",
  collaboration_status_updated: "連携ステータス変更",
  tver_campaign_created: "TVer配信申請作成",
  tver_campaign_deleted: "TVer配信申請削除",
  advertiser_review_created: "業態考査申請作成",
  advertiser_review_status_updated: "業態考査ステータス変更",
  advertiser_review_deleted: "業態考査削除",
  tver_creative_review_created: "クリエイティブ考査作成",
  tver_creative_review_deleted: "クリエイティブ考査削除",
  video_achievement_created: "動画実績作成",
  video_achievement_deleted: "動画実績削除",
  revenue_report_created: "売上報告作成",
  revenue_report_updated: "売上報告更新",
  revenue_report_deleted: "売上報告削除",
  wiki_article_created: "Wiki記事作成",
  wiki_article_updated: "Wiki記事更新",
  wiki_article_deleted: "Wiki記事削除",
};

// アクションの色分け
function getActionStyle(action: string): string {
  if (action.includes("deleted")) return "bg-red-50 text-red-700 border-red-200";
  if (action.includes("created") || action === "login_success") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (action.includes("updated")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (action === "login_failed") return "bg-red-50 text-red-700 border-red-200";
  return "bg-zinc-50 text-zinc-700 border-zinc-200";
}

export function LoginLogTable({ logs }: Props) {
  if (logs.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/60">
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">
                日時
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">
                操作
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">
                メールアドレス
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">
                名前
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">
                対象
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">
                詳細
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">
                IP
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">
                ブラウザ
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr
                key={log.id}
                className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors"
              >
                <td className="px-4 py-2.5 text-zinc-600 whitespace-nowrap">
                  {formatDate(log.createdAt)}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border whitespace-nowrap",
                      getActionStyle(log.action),
                    )}
                  >
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-zinc-900 font-medium">
                  {log.email}
                </td>
                <td className="px-4 py-2.5 text-zinc-600">
                  {log.name ?? "-"}
                </td>
                <td className="px-4 py-2.5 text-zinc-500">
                  {log.entity ?? "-"}
                </td>
                <td className="px-4 py-2.5 text-zinc-500 max-w-[200px] truncate">
                  {log.detail ?? "-"}
                </td>
                <td className="px-4 py-2.5 text-zinc-500 font-mono text-[11px]">
                  {log.ipAddress ?? "-"}
                </td>
                <td className="px-4 py-2.5 text-zinc-500">
                  {shortenUA(log.userAgent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
