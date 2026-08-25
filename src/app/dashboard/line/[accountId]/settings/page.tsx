import { loadAccountPage } from "@/lib/line/page-helpers";
import { AccountHeader } from "@/components/line/account-header";
import { AccountForm } from "@/components/line/account-form";
import { ActionButton, ConfirmButton } from "@/components/line/action-buttons";
import { testLineConnection, deleteLineAccount } from "@/lib/actions/line";
import { webhookUrl, addFriendUrl, fmtJst } from "@/lib/line/format";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { CannedReplyManager } from "@/components/line/canned-replies";
import { TagManager } from "@/components/line/tag-manager";
import { KeywordRuleManager } from "@/components/line/keyword-rules";
import { LinkManager } from "@/components/line/link-manager";
import { FormManager } from "@/components/line/form-manager";
import { parseFormFields } from "@/lib/line/service";

export const dynamic = "force-dynamic";

export default async function LineSettingsPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const { account } = await loadAccountPage(accountId);
  const hook = webhookUrl(account.id);
  const [canned, tagDefs, friendTags, rules, linkRows, formRows] = await Promise.all([
    db.lineCannedReply.findMany({ where: { accountId }, orderBy: { order: "asc" }, select: { id: true, title: true, text: true } }),
    db.lineTag.findMany({ where: { accountId }, orderBy: { order: "asc" } }),
    db.lineFriend.findMany({ where: { accountId }, select: { tags: true } }),
    db.lineKeywordRule.findMany({ where: { accountId }, orderBy: { createdAt: "asc" } }),
    db.lineLink.findMany({ where: { accountId }, orderBy: { createdAt: "asc" }, include: { clicks: { select: { friendId: true } } } }),
    db.lineForm.findMany({ where: { accountId }, orderBy: { createdAt: "asc" } }),
  ]);
  const forms = formRows.map((f) => ({
    id: f.id, title: f.title, code: f.code, description: f.description, thankYouText: f.thankYouText,
    addTags: f.addTags, isActive: f.isActive, responseCount: f.responseCount, fields: parseFormFields(f.fields),
  }));
  const links = linkRows.map((l) => ({
    id: l.id, label: l.label, code: l.code, url: l.url, addTags: l.addTags, clickCount: l.clickCount,
    uniqueCount: new Set(l.clicks.map((c) => c.friendId)).size,
  }));
  const tagCount = new Map<string, number>();
  for (const f of friendTags) for (const t of f.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const tags = tagDefs.map((t) => ({ id: t.id, name: t.name, color: t.color, note: t.note, count: tagCount.get(t.name) ?? 0 }));
  const addUrl = addFriendUrl(account.basicId);

  async function test() {
    "use server";
    return testLineConnection(accountId);
  }
  async function remove() {
    "use server";
    const r = await deleteLineAccount(accountId);
    if (r.ok) redirect("/dashboard/line");
    return r;
  }

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      <AccountHeader account={account} />

      <section className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
        <p className="text-sm font-bold text-zinc-900">LINE Developers 側の設定（1回だけ）</p>
        <ol className="text-xs text-zinc-600 space-y-1.5 list-decimal pl-4">
          <li>LINE Developers → 該当チャネル → <b>Messaging API設定</b> を開く</li>
          <li>
            <b>Webhook URL</b> に次を貼って「検証」→「Webhookの利用」を<b>ON</b>
            <code className="block mt-1 bg-zinc-50 border border-zinc-200 rounded px-2 py-1 text-[11px] break-all select-all">{hook}</code>
          </li>
          <li>LINE Official Account Manager → 設定 → 応答設定：<b>応答メッセージ OFF／Webhook ON</b>（あいさつは本OSから送るので「あいさつメッセージ」もOFF推奨）</li>
        </ol>
        {account.webhookError && (!account.webhookLastAt || (account.webhookErrorAt && account.webhookErrorAt > account.webhookLastAt)) && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            ⚠️ {fmtJst(account.webhookErrorAt)} にLINEからの通知を弾きました：{account.webhookError}
          </p>
        )}
        {!account.webhookLastAt && !account.webhookError && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            まだLINEからの通知が一度も届いていません。手順2のWebhook URL登録と「Webhookの利用 ON」を確認してください。
            （すでに友だちの方は、追加後にメッセージを送ってもらうまで一覧には出ません）
          </p>
        )}
        <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-600">
          <span>最終Webhook受信: <b>{fmtJst(account.webhookLastAt)}</b></span>
          <span>ボット名: <b>{account.botDisplayName ?? "—"}</b></span>
          <ActionButton label="接続テスト" action={test} />
        </div>
        {addUrl && (
          <p className="text-xs text-zinc-600">
            友だち追加URL: <a href={addUrl} target="_blank" rel="noreferrer" className="text-emerald-700 underline break-all">{addUrl}</a>
            <span className="text-zinc-400">（LPやメール署名にこれを貼ります）</span>
          </p>
        )}
      </section>

      <AccountForm
        ownerLabel=""
        account={{
          id: account.id,
          name: account.name,
          channelId: account.channelId,
          greetingText: account.greetingText,
          autoReplyText: account.autoReplyText,
        }}
      />

      <TagManager accountId={accountId} tags={tags} />
      <KeywordRuleManager accountId={accountId} rules={rules} tagNames={tags.map((t) => t.name)} />
      <LinkManager accountId={accountId} links={links} tagNames={tags.map((t) => t.name)} />
      <FormManager accountId={accountId} forms={forms} tagNames={tags.map((t) => t.name)} />
      <CannedReplyManager accountId={accountId} items={canned} />

      <section className="bg-white rounded-xl border border-red-100 p-4 flex items-center justify-between">
        <p className="text-xs text-zinc-600">このアカウントの接続を解除する（友だち・会話・シナリオもOSから消えます。LINE側のアカウントは残ります）</p>
        <ConfirmButton label="接続を解除" confirmLabel="本当に解除する" action={remove} danger />
      </section>
    </div>
  );
}
