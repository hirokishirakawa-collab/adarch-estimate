import { db } from "@/lib/db";
import { loadAccountPage } from "@/lib/line/page-helpers";
import { AccountHeader } from "@/components/line/account-header";
import { NewScenarioToggle, ScenarioEditToggle } from "@/components/line/scenario-editor";
import { ActionButton, ConfirmButton } from "@/components/line/action-buttons";
import { deleteLineScenario, toggleLineScenario, seedFranchiseScenario, seedClientScenario } from "@/lib/actions/line";
import { TRIGGER_LABEL } from "@/lib/line/format";

export const dynamic = "force-dynamic";

export default async function LineScenariosPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const { info, account } = await loadAccountPage(accountId);
  const scenarios = await db.lineScenario.findMany({
    where: { accountId },
    orderBy: { createdAt: "asc" },
    include: {
      steps: { orderBy: { order: "asc" } },
      _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
    },
  });
  const isHq = info.role === "ADMIN" && account.branchId === null;

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      <AccountHeader account={account} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-zinc-500">友だち追加やタグ付けをきっかけに、決めた日・時刻に順番に送ります。</p>
        <div className="flex items-center gap-2">
          {isHq && (
            <ActionButton
              label="加盟促進テンプレを投入"
              action={async () => {
                "use server";
                return seedFranchiseScenario(accountId);
              }}
              successText="投入しました（無効状態）。本文を確認してから有効にしてください"
            />
          )}
          <ActionButton
            label="クライアント対応テンプレを投入"
            action={async () => {
              "use server";
              return seedClientScenario(accountId);
            }}
            successText="投入しました（無効状態）。自社向けに本文を直してから有効にしてください"
          />
          <NewScenarioToggle accountId={accountId} />
        </div>
      </div>

      {scenarios.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">まだシナリオはありません。</div>
      ) : (
        <div className="space-y-3">
          {scenarios.map((sc) => (
            <div key={sc.id} className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    {sc.name}
                    <span className={`text-[10px] rounded px-1.5 ${sc.isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                      {sc.isActive ? "有効" : "無効"}
                    </span>
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {TRIGGER_LABEL[sc.trigger]}
                    {sc.trigger === "TAG" && sc.triggerTag ? `「${sc.triggerTag}」` : ""} ・ {sc.steps.length}通 ・ 配信中 {sc._count.enrollments}人
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ActionButton
                    label={sc.isActive ? "無効にする" : "有効にする"}
                    action={async () => {
                      "use server";
                      return toggleLineScenario(accountId, sc.id, !sc.isActive);
                    }}
                  />
                  <ScenarioEditToggle
                    accountId={accountId}
                    scenario={{
                      id: sc.id,
                      name: sc.name,
                      trigger: sc.trigger,
                      triggerTag: sc.triggerTag,
                      isActive: sc.isActive,
                      steps: sc.steps.map((st) => ({ delayDays: st.delayDays, sendHour: st.sendHour, text: st.text, addTags: st.addTags.join(", ") })),
                    }}
                  />
                  <ConfirmButton
                    label="削除"
                    confirmLabel="本当に削除"
                    danger
                    action={async () => {
                      "use server";
                      return deleteLineScenario(accountId, sc.id);
                    }}
                  />
                </div>
              </div>
              <ol className="space-y-1.5">
                {sc.steps.map((st) => (
                  <li key={st.id} className="text-xs text-zinc-700 flex gap-2">
                    <span className="shrink-0 text-zinc-400 w-28">
                      {st.order}通目: {st.delayDays}日後{st.sendHour === null ? " 即時" : ` ${st.sendHour}:00`}
                    </span>
                    <span className="whitespace-pre-wrap line-clamp-2">{st.text}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
