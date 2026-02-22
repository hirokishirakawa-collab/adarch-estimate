/**
 * Supabase Storage へのファイルアップロードユーティリティ。
 *
 * 必要な環境変数:
 *   SUPABASE_URL              例: https://tyddrnzqxhgakwbhgusd.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY Supabase ダッシュボード > Settings > API > service_role key
 *
 * Supabase ダッシュボードで "billing-pdfs" という名前の
 * Public バケットを事前に作成してください。
 */

const BUCKET = "billing-pdfs";
const GROUP_SYNC_BUCKET = "group-sync-files";
const MEDIA_BUCKET = "media-files";

export async function uploadBillingFile(
  file: File
): Promise<string | null> {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.warn(
      "[storage] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定のため" +
      " ファイルアップロードをスキップします。"
    );
    return null;
  }

  const ext      = file.name.split(".").pop() ?? "pdf";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const endpoint = `${supabaseUrl}/storage/v1/object/${BUCKET}/${fileName}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${serviceKey}`,
        "Content-Type": file.type || "application/pdf",
        "x-upsert":     "false",
      },
      body: Buffer.from(await file.arrayBuffer()),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[storage] Supabase upload failed:", res.status, body);
      return null;
    }

    return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${fileName}`;
  } catch (e) {
    console.error("[storage] Upload error:", e);
    return null;
  }
}

export async function uploadGroupSyncFile(
  file: File
): Promise<string | null> {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.warn(
      "[storage] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定のため" +
      " ファイルアップロードをスキップします。"
    );
    return null;
  }

  const ext      = file.name.split(".").pop() ?? "bin";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const endpoint = `${supabaseUrl}/storage/v1/object/${GROUP_SYNC_BUCKET}/${fileName}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${serviceKey}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert":     "false",
      },
      body: Buffer.from(await file.arrayBuffer()),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[storage] Supabase upload failed:", res.status, body);
      return null;
    }

    return `${supabaseUrl}/storage/v1/object/public/${GROUP_SYNC_BUCKET}/${fileName}`;
  } catch (e) {
    console.error("[storage] Upload error:", e);
    return null;
  }
}

export async function uploadMediaFile(
  file: File
): Promise<string | null> {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.warn(
      "[storage] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定のため" +
      " ファイルアップロードをスキップします。"
    );
    return null;
  }

  const ext      = file.name.split(".").pop() ?? "bin";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const endpoint = `${supabaseUrl}/storage/v1/object/${MEDIA_BUCKET}/${fileName}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${serviceKey}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert":     "false",
      },
      body: Buffer.from(await file.arrayBuffer()),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[storage] Supabase upload failed:", res.status, body);
      return null;
    }

    return `${supabaseUrl}/storage/v1/object/public/${MEDIA_BUCKET}/${fileName}`;
  } catch (e) {
    console.error("[storage] Upload error:", e);
    return null;
  }
}
