import { db } from "@/lib/db";

interface AuditLogInput {
  action: string;
  email: string;
  name?: string | null;
  entity?: string | null;
  entityId?: string | null;
  detail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * 監査ログを DB に記録する。
 * 本体処理をブロックしないよう、書き込み失敗時は console.error のみ。
 */
export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: input.action,
        email: input.email,
        name: input.name ?? null,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        detail: input.detail ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (e) {
    console.error("[AuditLog] 記録失敗:", e);
  }
}
