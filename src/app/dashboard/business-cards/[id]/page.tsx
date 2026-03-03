import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  User,
  Globe,
  Phone,
  Calendar,
  Tag,
  Sparkles,
  MapPin,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { REGION_OPTIONS } from "@/lib/constants/business-cards";
import { FlagToggles } from "@/components/business-cards/flag-toggles";
import { PrivateFieldsPanel } from "@/components/business-cards/private-fields-panel";
import { MatchingPanel } from "@/components/business-cards/matching-panel";
import { BusinessCardDeleteButton } from "@/components/business-cards/business-card-delete-button";
import { OwnerSelect } from "@/components/business-cards/owner-select";
import { getCardImageSignedUrl } from "@/lib/storage";

function InfoItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-zinc-50 last:border-0">
      {Icon && (
        <Icon className="w-3.5 h-3.5 text-zinc-400 mt-0.5 flex-shrink-0" />
      )}
      <div>
        <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-xs text-zinc-700 mt-0.5">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

export default async function BusinessCardDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sessionInfo = await getSessionInfo();
  if (!sessionInfo) redirect("/login");

  const { id } = await props.params;

  const card = await db.businessCard.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true } },
      disclosureRequests: {
        where: { requesterId: sessionInfo.userId },
        select: { status: true },
      },
    },
  });

  if (!card) notFound();

  // 秘匿フィールド閲覧権限の判定
  const canViewPrivate =
    sessionInfo.role === "ADMIN" ||
    card.ownerId === sessionInfo.userId ||
    card.disclosureRequests.some((r) => r.status === "APPROVED");

  // 開示申請の状態を取得
  const existingRequest = card.disclosureRequests[0] ?? null;

  // ADMIN: 所有者変更用のユーザー一覧
  const allUsers =
    sessionInfo.role === "ADMIN"
      ? await db.user.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

  // 地域ラベル取得
  const regionLabels: string[] = [];
  for (const r of REGION_OPTIONS) {
    if (card[r.value as keyof typeof card]) {
      regionLabels.push(r.label);
    }
  }

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-xl mx-auto w-full">
      {/* パンくず */}
      <Link
        href="/dashboard/business-cards"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        名刺一覧に戻る
      </Link>

      {/* ヘッダーカード */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <div className="flex items-start justify-between">
            <div>
              {/* フラグバッジ（トグル可能） */}
              <div className="flex items-center gap-1.5 mb-2">
                <FlagToggles
                  cardId={card.id}
                  initialFlags={{
                    isCompetitor: card.isCompetitor,
                    wantsCollab: card.wantsCollab,
                    isOrdered: card.isOrdered,
                    isCreator: card.isCreator,
                  }}
                  canEdit={sessionInfo.role === "ADMIN" || card.ownerId === sessionInfo.userId}
                />
                {card.aiIndustry && (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-teal-50 text-teal-600 border border-teal-100">
                    {card.aiIndustry}
                  </span>
                )}
              </div>
              <h1 className="text-lg font-bold text-zinc-900">
                {card.lastName} {card.firstName ?? ""}
              </h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                {card.companyName}
                {card.department ? ` / ${card.department}` : ""}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="text-right">
                <p className="text-[10px] text-zinc-400">所有者</p>
                {sessionInfo.role === "ADMIN" ? (
                  <OwnerSelect
                    cardId={card.id}
                    currentOwnerId={card.ownerId}
                    users={allUsers.map((u) => ({ id: u.id, name: u.name ?? "—" }))}
                  />
                ) : (
                  <p className="text-xs font-medium text-zinc-700">
                    {card.owner?.name ?? "—"}
                  </p>
                )}
              </div>
              {sessionInfo.role === "ADMIN" && (
                <BusinessCardDeleteButton
                  cardId={card.id}
                  cardLabel={`${card.companyName} ${card.lastName}`}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 左カラム: 公開情報 */}
        <div className="space-y-5">
          {/* 基本情報 */}
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                <h3 className="text-xs font-semibold text-zinc-700">基本情報</h3>
              </div>
            </div>
            <div className="px-4 py-2">
              <InfoItem icon={Building2} label="会社名" value={card.companyName} />
              <InfoItem icon={Building2} label="部署" value={card.department} />
              <InfoItem icon={User} label="役職" value={card.title} />
              <InfoItem icon={User} label="氏名" value={`${card.lastName} ${card.firstName ?? ""}`} />
              {(card.lastNameKana || card.firstNameKana) && (
                <InfoItem
                  icon={User}
                  label="フリガナ"
                  value={`${card.lastNameKana ?? ""} ${card.firstNameKana ?? ""}`}
                />
              )}
              <InfoItem icon={Phone} label="会社電話" value={card.companyPhone} />
              <InfoItem icon={Globe} label="URL" value={card.url} />
              <InfoItem icon={MapPin} label="都道府県" value={card.prefecture} />
              <InfoItem
                icon={Calendar}
                label="名刺交換日"
                value={card.exchangeDate ? new Date(card.exchangeDate).toLocaleDateString("ja-JP") : null}
              />
              {card.tags && <InfoItem icon={Tag} label="タグ" value={card.tags} />}
            </div>
          </div>

          {/* 地域 */}
          {regionLabels.length > 0 && (
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                  <h3 className="text-xs font-semibold text-zinc-700">担当エリア</h3>
                </div>
              </div>
              <div className="px-4 py-3 flex flex-wrap gap-1.5">
                {regionLabels.map((r) => (
                  <span
                    key={r}
                    className="inline-flex px-2 py-1 rounded bg-zinc-100 text-zinc-600 text-[11px] font-medium"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AI 分析 */}
          {(card.aiIndustry || card.aiSummary) && (
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
                  <h3 className="text-xs font-semibold text-zinc-700">AI 分析</h3>
                </div>
              </div>
              <div className="px-4 py-3 space-y-2">
                {card.aiIndustry && (
                  <div>
                    <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">
                      業界
                    </p>
                    <p className="text-xs text-zinc-700 mt-0.5">{card.aiIndustry}</p>
                  </div>
                )}
                {card.aiSummary && (
                  <div>
                    <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">
                      事業概要
                    </p>
                    <p className="text-xs text-zinc-700 mt-0.5">{card.aiSummary}</p>
                  </div>
                )}
                {card.aiTags && (
                  <div>
                    <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">
                      AI タグ
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {card.aiTags.split(",").map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 text-[10px]"
                        >
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 右カラム: 秘匿情報 + 開示申請 */}
        <div className="space-y-5">
          <PrivateFieldsPanel
            canView={canViewPrivate}
            fields={{
              email: card.email,
              directPhone: card.directPhone,
              mobilePhone: card.mobilePhone,
              fax: card.fax,
              postalCode: card.postalCode,
              address: card.address,
              sharedMemoTitle: card.sharedMemoTitle,
              exchangePlace: card.exchangePlace,
              workHistory: card.workHistory,
              personality: card.personality,
              textMemo: card.textMemo,
            }}
          />

          {/* 開示申請ボタン */}
          {!canViewPrivate && (
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              {existingRequest ? (
                <div className="text-center">
                  <p className="text-xs text-zinc-500">
                    開示申請ステータス:{" "}
                    <span
                      className={
                        existingRequest.status === "PENDING"
                          ? "text-amber-600 font-medium"
                          : "text-red-600 font-medium"
                      }
                    >
                      {existingRequest.status === "PENDING" ? "審査中" : "却下"}
                    </span>
                  </p>
                </div>
              ) : (
                <Link
                  href={`/dashboard/business-cards/${card.id}/request`}
                  className="flex items-center justify-center gap-1.5 w-full px-4 py-2.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
                >
                  秘匿情報の開示を申請する
                </Link>
              )}
            </div>
          )}

          {/* AI マッチング */}
          <MatchingPanel companyName={card.companyName} />

          {/* 名刺画像（秘匿情報と同じ権限で制御 — 名刺には個人情報が写っているため） */}
          {card.cardImageUrl && canViewPrivate && (
            <CardImageSection filePath={card.cardImageUrl} />
          )}
        </div>
      </div>
    </div>
  );
}

/** 署名付きURLでPrivateバケットの名刺画像を表示する（サーバーコンポーネント） */
async function CardImageSection({ filePath }: { filePath: string }) {
  const signedUrl = await getCardImageSignedUrl(filePath);
  if (!signedUrl) return null;

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
        <h3 className="text-xs font-semibold text-zinc-700">名刺画像</h3>
      </div>
      <div className="p-4">
        <img
          src={signedUrl}
          alt="名刺画像"
          className="w-full rounded-lg border border-zinc-200"
        />
      </div>
    </div>
  );
}
