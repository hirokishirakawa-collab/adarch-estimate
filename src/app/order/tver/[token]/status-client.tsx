"use client";

// TVer小口申込 — 進捗ページのフォーム類（決済へ進む／詳細記入／動画提出）

import { useActionState, useState, useTransition } from "react";
import { INDUSTRY_OPTIONS } from "@/lib/tver-order/plans";
import { lookupCorporateNumber } from "../area-actions";
import { goToPayment, submitMaterialUrl, submitOrderDetails, type DetailsState, type MaterialState } from "./actions";

export function PayButton({ token, label }: { token: string; label?: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        className="button payment-button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await goToPayment(token);
            if (r?.error) setErr(r.error);
          })
        }
      >
        {pending ? "決済ページへ移動中…" : label ?? "お支払いへ進む（カード）"} <span aria-hidden="true">→</span>
      </button>
      {err && <p className="small" style={{ color: "var(--pressed)" }}>{err}</p>}
      <p className="payment-help">Square の安全な決済画面に移動します。</p>
    </div>
  );
}

export function DetailsForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<DetailsState, FormData>(submitOrderDetails, null);
  const [corpNo, setCorpNo] = useState("");
  const [name, setName] = useState("");
  const [postal, setPostal] = useState("");
  const [address, setAddress] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [looking, startLookup] = useTransition();
  const lookup = () => {
    setMsg("照会中…");
    startLookup(async () => {
      const r = await lookupCorporateNumber(corpNo);
      if (r.error) return setMsg(r.error);
      if (r.name) setName(r.name);
      if (r.address) setAddress(r.address);
      if (r.postalCode) setPostal(r.postalCode);
      setMsg(`国税庁の法人番号公表サイトから取得: ${r.name ?? ""}${r.address ? "" : "（住所は手入力してください）"}`);
    });
  };
  if (state?.success) {
    return (
      <div className="note">
        <strong>ありがとうございます</strong>
        <p>詳細を受け付けました。本部がTVerへ業態考査を申請します。結果はメールでお知らせします。</p>
      </div>
    );
  }
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <label className="field">
        法人番号<span className="required">必須・13桁</span>
        <input type="text" name="corporateNumber" inputMode="numeric" maxLength={13} required value={corpNo} onChange={(e) => setCorpNo(e.target.value.replace(/\D/g, ""))} />
      </label>
      {/^\d{13}$/.test(corpNo) && (
        <button type="button" className="text-button" onClick={lookup} disabled={looking}>社名・所在地を自動入力</button>
      )}
      <p className="small">{msg ?? "国税庁の法人番号公表サイトから社名・所在地を自動入力できます。"}</p>
      {name && <p className="small">登記上の社名: <b style={{ color: "var(--ink)" }}>{name}</b>（申込時の会社名と違う場合は本部で確認します）</p>}
      <div className="field-grid">
        <label className="field">郵便番号<span className="small">任意</span><input type="text" name="postalCode" inputMode="numeric" placeholder="760-0000" value={postal} onChange={(e) => setPostal(e.target.value)} /></label>
        <label className="field">代表者名<span className="required">必須</span><input type="text" name="representativeName" required /></label>
      </div>
      <label className="field">本店所在地<span className="required">必須</span><input type="text" name="address" required autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} /></label>
      <label className="field">
        業種<span className="small">任意</span>
        <select name="industry" defaultValue="">
          <option value="">選択してください</option>
          {INDUSTRY_OPTIONS.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
      </label>
      <label className="field">CMのリンク先URL<span className="small">任意</span><input type="url" name="landingPageUrl" placeholder="https://" /></label>
      <label className="field">備考<span className="small">任意</span><textarea name="notes" rows={3} /></label>
      {state?.error && <p className="small" style={{ color: "var(--pressed)" }}>{state.error}</p>}
      <button type="submit" className="button" disabled={pending} style={{ marginTop: 16 }}>
        {pending ? "送信中…" : "この内容で考査に進む"} <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}

export function MaterialForm({ token, current, replace }: { token: string; current: string | null; replace?: boolean }) {
  const [state, action, pending] = useActionState<MaterialState, FormData>(submitMaterialUrl, null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [upMsg, setUpMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const upload = async () => {
    if (!file) return setUpMsg("動画ファイルを選んでください");
    setUploading(true);
    setUpMsg("アップロード中…（回線によって数分かかります）");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/tver-order/${token}/material`, { method: "POST", body: fd });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) return setUpMsg(j.error ?? "アップロードに失敗しました");
      setUpMsg("受け取りました。ありがとうございます。");
      setDone(true);
    } catch {
      setUpMsg("アップロードに失敗しました。URL共有をお試しください");
    } finally {
      setUploading(false);
    }
  };

  if (done || state?.success) {
    return (
      <div className="note">
        <strong>動画を受け取りました</strong>
        <p>本部で規定チェックと入稿を進めます。配信開始日はメールでお知らせします。</p>
      </div>
    );
  }
  return (
    <div>
      {current && (
        <p className="small" style={{ marginBottom: 8 }}>
          {replace ? "受領済みの動画" : "お預かり中の動画"}: <a href={current} target="_blank" rel="noopener">{current.length > 60 ? current.slice(0, 60) + "…" : current}</a>
          {replace ? "（差し替える場合は下から再提出してください）" : ""}
        </p>
      )}
      <label className="upload-area">
        動画ファイルを選択<span className="small">15秒CM / MP4・MOV（300MBまで）</span>
        <input type="file" name="video_file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {file && <p className="small">{file.name}（{(file.size / 1024 / 1024).toFixed(1)}MB）</p>}
      <button type="button" className="button" onClick={upload} disabled={uploading || !file}>
        {uploading ? "アップロード中…" : "動画をアップロードする"} <span aria-hidden="true">→</span>
      </button>
      {upMsg && <p className="small">{upMsg}</p>}
      <form action={action} style={{ marginTop: 20 }}>
        <input type="hidden" name="token" value={token} />
        <label className="field">または 動画の共有URL<span className="small">Google Drive・ギガファイル便など</span><input type="url" name="materialUrl" placeholder="https://" required /></label>
        <label className="field">メモ<span className="small">任意</span><input type="text" name="materialNote" placeholder="例: 2案あります。A案でお願いします" /></label>
        {state?.error && <p className="small" style={{ color: "var(--pressed)" }}>{state.error}</p>}
        <button type="submit" className="button" disabled={pending} style={{ marginTop: 12 }}>
          {pending ? "送信中…" : "URLを提出する"} <span aria-hidden="true">→</span>
        </button>
      </form>
    </div>
  );
}
