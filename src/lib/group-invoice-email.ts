// サーバー専用 — グループ請求書PDFを生成しパートナーへメール送付する
import { db } from "@/lib/db";
import { sendGroupInvoiceEmail } from "@/lib/resend";

function fmtDateJa(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
}

/// 請求書IDから PDF を生成し、パートナーのOSユーザーのメールへ送付（本部にBCC）。
export async function sendGroupInvoiceEmailById(
  invoiceId: string,
): Promise<{ ok: boolean; error?: string; sentTo?: string[] }> {
  const invoice = await db.groupInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      groupCompany: { select: { id: true, name: true, ownerName: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!invoice) return { ok: false, error: "請求書が見つかりません" };

  // 宛先＝パートナーに紐づくOSユーザーのメール
  const users = await db.user.findMany({
    where: { groupCompanyId: invoice.groupCompanyId },
    select: { email: true },
  });
  const to = users.map((u) => u.email).filter((e): e is string => !!e);
  if (to.length === 0) {
    return { ok: false, error: "送信先メールが見つかりません（パートナーにOSユーザーが紐づいていません）" };
  }

  // PDF 生成
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const React = (await import("react")).default;
  const { GroupInvoicePDFDocument } = await import("@/components/group-invoices/group-invoice-pdf");
  const pdfData = {
    invoiceNo: invoice.invoiceNo,
    type: invoice.type,
    title: invoice.title,
    targetMonth: invoice.targetMonth,
    description: invoice.description,
    subtotalExclTax: Number(invoice.subtotalExclTax),
    taxAmount: Number(invoice.taxAmount),
    totalInclTax: Number(invoice.totalInclTax),
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    status: invoice.status,
    groupCompany: { name: invoice.groupCompany.name, ownerName: invoice.groupCompany.ownerName },
    items: invoice.items.map((it) => ({
      name: it.name,
      detail: it.detail,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      amount: Number(it.amount),
    })),
  };
  const pdf = await renderToBuffer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    React.createElement(GroupInvoicePDFDocument, { invoice: pdfData }) as any,
  );

  const bccEnv = process.env.NOTIFICATION_EMAIL_TO;
  await sendGroupInvoiceEmail({
    to,
    bcc: bccEnv ? [bccEnv] : undefined,
    partnerName: invoice.groupCompany.name,
    ownerName: invoice.groupCompany.ownerName,
    invoiceNo: invoice.invoiceNo,
    title: invoice.title,
    totalInclTax: Number(invoice.totalInclTax),
    dueDate: fmtDateJa(invoice.dueDate),
    pdfBuffer: Buffer.from(pdf),
    pdfFilename: `invoice_${invoice.invoiceNo}.pdf`,
  });

  return { ok: true, sentTo: to };
}
