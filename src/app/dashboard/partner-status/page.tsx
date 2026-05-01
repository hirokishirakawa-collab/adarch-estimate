import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Activity, AlertTriangle, FileText, Shield, Scale, Eye, MessageSquareWarning } from "lucide-react";
import { PartnerStatusSelector } from "@/components/partner-status/status-selector";

export default async function PartnerStatusPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  // ユーザーと所属企業を取得
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { groupCompanyId: true, groupCompany: { select: { name: true } } },
  });

  // パートナー未登録の場合
  if (!user?.groupCompanyId) {
    return (
      <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center">
            <Activity
              className="text-zinc-600"
              style={{ width: "1.125rem", height: "1.125rem" }}
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">
              稼働ステータス
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              月次の稼働ステータスを選択してください
            </p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <p className="text-sm font-semibold text-amber-800">
            パートナー登録が必要です
          </p>
          <p className="text-xs text-amber-600 mt-1">
            この機能を利用するには、グループ企業への紐付けが必要です。本部にお問い合わせください。
          </p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // 当月のステータスを取得（なければ自動作成）
  const currentStatus = await db.partnerStatus.upsert({
    where: {
      groupCompanyId_year_month: {
        groupCompanyId: user.groupCompanyId,
        year,
        month,
      },
    },
    create: {
      groupCompanyId: user.groupCompanyId,
      year,
      month,
      status: "NOT_SELECTED",
    },
    update: {},
    include: {
      groupCompany: { select: { name: true, ownerName: true } },
    },
  });

  // 変更履歴（直近6ヶ月分）
  const sixMonthsAgo = new Date(year, month - 7, 1);
  const logs = await db.partnerStatusLog.findMany({
    where: {
      groupCompanyId: user.groupCompanyId,
      createdAt: { gte: sixMonthsAgo },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // シリアライズ
  const serializedStatus = {
    ...currentStatus,
    selectedAt: currentStatus.selectedAt?.toISOString() ?? null,
    createdAt: currentStatus.createdAt.toISOString(),
    updatedAt: currentStatus.updatedAt.toISOString(),
  };

  const userEmail = session.user.email;
  const serializedLogs = logs.map((l) => ({
    id: l.id,
    fromStatus: l.fromStatus,
    toStatus: l.toStatus,
    reason: l.reason,
    changedBy:
      l.changedBy === userEmail ? "自分" :
      l.changedBy === "SYSTEM" ? "システム自動" :
      l.changedBy === "ADMIN_MANUAL" ? "管理者" :
      l.changedBy.includes("@") ? "管理者" : l.changedBy,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center">
          <Activity
            className="text-zinc-600"
            style={{ width: "1.125rem", height: "1.125rem" }}
          />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">稼働ステータス申告</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            毎月の稼働状況を申告してください（認定パートナー基本契約 第9条に基づく報告義務）
          </p>
        </div>
      </div>

      {/* ステータス選択 */}
      <PartnerStatusSelector
        initialStatus={serializedStatus as never}
        logs={serializedLogs}
        companyName={user.groupCompany?.name ?? ""}
      />

      {/* ── 運用ルール説明 ── */}
      <div className="bg-white border border-zinc-200 rounded-xl px-5 py-5 space-y-5">
        <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
          <Scale className="w-4 h-4 text-zinc-500" />
          稼働ステータスの運用ルール
        </h3>

        {/* ルール1: 稼働中の場合 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-100 text-emerald-700">
              稼働中
            </span>
            <span className="text-xs font-semibold text-zinc-700">を選択した場合</span>
          </div>
          <ul className="space-y-1.5 text-xs text-zinc-600 ml-1">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">●</span>
              <span>本部およびグループ案件の紹介・共同稼働の対象となります</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">●</span>
              <span>全OS機能をご利用いただけます</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">▲</span>
              <span>「稼働中」選択月に<strong className="text-zinc-800">営業報告・プロジェクト報告がいずれもゼロ</strong>の場合、稼働実態が伴っていないと判断し、<strong className="text-zinc-800">精算を保留</strong>いたします（第9条2項）</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">▲</span>
              <span><strong className="text-zinc-800">2ヶ月連続で報告ゼロ</strong>の場合、ステータスを<strong className="text-zinc-800">「活動休止中」へ強制的に切り替え</strong>させていただきます</span>
            </li>
          </ul>
        </div>

        <hr className="border-zinc-100" />

        {/* ルール2: 活動休止中の場合 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-700">
              活動休止中
            </span>
            <span className="text-xs font-semibold text-zinc-700">を選択した場合</span>
          </div>
          <ul className="space-y-1.5 text-xs text-zinc-600 ml-1">
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">●</span>
              <span>OS機能の一部が停止されます（案件紹介・ツール・ノウハウ提供等）</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">●</span>
              <span>案件紹介・共同稼働の<strong className="text-zinc-800">対象外</strong>となります</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">●</span>
              <span>マネジメント料（第8条）は引き続き発生いたします</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">▲</span>
              <span>休止が<strong className="text-zinc-800">3ヶ月を超えた場合</strong>、アドアーチグループとしての<strong className="text-zinc-800">活動意思がないものと判断</strong>し、第14条第5号「パートナーとして事業継続が困難と判断される重大な事由」に該当するものとして<strong className="text-zinc-800">契約解除の検討対象</strong>となります</span>
            </li>
          </ul>
          <p className="text-[11px] text-zinc-500 ml-1">
            ※ お忙しい場合の一時休止は問題ありません。ただし、休止が長期間続く場合はグループとしての活動意思がないものと判断させていただきます。
          </p>
        </div>

        <hr className="border-zinc-100" />

        {/* ルール3: 未選択の場合 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-zinc-100 text-zinc-600">
              未選択
            </span>
            <span className="text-xs font-semibold text-zinc-700">のまま月末を迎えた場合</span>
          </div>
          <ul className="space-y-1.5 text-xs text-zinc-600 ml-1">
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">▲</span>
              <span>第9条に定める<strong className="text-zinc-800">報告義務違反</strong>として扱い、<strong className="text-zinc-800">精算を保留</strong>いたします</span>
            </li>
          </ul>
        </div>
      </div>

      {/* ── 報告義務について ── */}
      <div className="bg-white border border-zinc-200 rounded-xl px-5 py-5 space-y-4">
        <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
          <FileText className="w-4 h-4 text-zinc-500" />
          報告義務について（第9条）
        </h3>
        <p className="text-xs text-zinc-600 leading-relaxed">
          認定パートナー基本契約第9条に基づき、以下の報告義務がございます。<strong className="text-zinc-800">「報告がない＝稼働実態が確認できない」</strong>ものとして取り扱いを判断いたします。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-zinc-50 rounded-lg px-4 py-3">
            <p className="text-[10px] text-zinc-500 font-semibold mb-0.5">（a）月次実績・活動報告書</p>
            <p className="text-xs text-zinc-700 font-medium">毎月末日まで</p>
          </div>
          <div className="bg-zinc-50 rounded-lg px-4 py-3">
            <p className="text-[10px] text-zinc-500 font-semibold mb-0.5">（b）週次活動報告</p>
            <p className="text-xs text-zinc-700 font-medium">各週末まで</p>
          </div>
          <div className="bg-zinc-50 rounded-lg px-4 py-3">
            <p className="text-[10px] text-zinc-500 font-semibold mb-0.5">（c）OS上の活動記録</p>
            <p className="text-xs text-zinc-700 font-medium">随時反映</p>
          </div>
        </div>
        <p className="text-[11px] text-zinc-500">
          （a）〜（c）のいずれかが未提出・未記載の場合、報告を怠ったものとして当該月の精算が保留される場合がございます。
        </p>
      </div>

      {/* ── 不正発覚時の対応 ── */}
      <div className="bg-red-50/50 border border-red-200 rounded-xl px-5 py-5 space-y-3">
        <h3 className="text-sm font-bold text-red-900 flex items-center gap-2">
          <Shield className="w-4 h-4 text-red-500" />
          不正行為が発覚した場合
        </h3>
        <p className="text-xs text-zinc-700 leading-relaxed">
          ブランド名の無断使用、甲の承諾を得ない直接契約、実績の詐称等の不正行為が確認された場合、段階的な警告を経ずに<strong className="text-red-800">原則「一発アウト」として即時に契約解除</strong>（第14条）および<strong className="text-red-800">損害賠償請求</strong>（第18条、上限300万円）の対象となります。
        </p>
        <p className="text-xs text-zinc-700 leading-relaxed">
          これは一社への厳罰ではなく、<strong className="text-zinc-900">グループ全体の信頼と、真面目に取り組まれている全パートナー各位の事業基盤を守るための防衛措置</strong>です。
        </p>
      </div>

      {/* ── 本部への確認連絡 ── */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-5 py-5 space-y-3">
        <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
          <Eye className="w-4 h-4 text-zinc-500" />
          本部への確認連絡について
        </h3>
        <p className="text-xs text-zinc-600 leading-relaxed">
          弊社には、営業先や取引先企業、業界関係者から、パートナー各位に関する確認の連絡が<strong className="text-zinc-800">随時入っています</strong>。
        </p>
        <div className="space-y-1.5 text-xs text-zinc-600 ml-1">
          <p>・営業先から：<strong className="text-zinc-800">「この方はAd Archグループとどういうご関係ですか？」</strong></p>
          <p>・クライアント企業から：<strong className="text-zinc-800">「この実績は本当に御社グループで制作されたものですか？」</strong></p>
          <p>・同業他社から：<strong className="text-zinc-800">「Ad Arch名義で営業されている方がいますが、正規のパートナーですか？」</strong></p>
        </div>
        <p className="text-xs text-zinc-600 leading-relaxed">
          弊社の承諾を得ていない営業活動や、事実と異なる実績の表示は、<strong className="text-zinc-800">いずれ必ず本部に届きます</strong>。弊社では外部からの照会対応、活動状況の確認、ブランド保全のための監視を常時稼働体制で行っております。
        </p>
      </div>

      {/* ── 通報機能リンク ── */}
      <Link
        href="/dashboard/violation-report"
        className="flex items-center gap-3 bg-white border border-zinc-200 rounded-xl px-5 py-4 hover:bg-zinc-50 transition group"
      >
        <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <MessageSquareWarning className="w-4 h-4 text-zinc-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-700">不正行為を発見された場合</p>
          <p className="text-xs text-zinc-500 mt-0.5">匿名での通報も可能です。グループの信頼を守るためにご協力をお願いいたします。</p>
        </div>
        <span className="text-xs text-zinc-400 group-hover:text-zinc-600 flex-shrink-0">通報する →</span>
      </Link>
    </div>
  );
}
