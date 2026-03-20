import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

Font.register({
  family: "NotoSansJP",
  fonts: [
    { src: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.0.1/files/noto-sans-jp-japanese-400-normal.woff", fontWeight: 400 },
    { src: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.0.1/files/noto-sans-jp-japanese-700-normal.woff", fontWeight: 700 },
  ],
});

// Brand colors: proposals.adarch.co.jp spec
const NAVY = "#0D1A2F";
const GOLD = "#B8943E";
const BG = "#F7F6F3";
const TEXT = "#1A1A1A";
const SUB = "#6B7280";
const BORDER = "#E5E2DC";

const s = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 9,
    color: TEXT,
    backgroundColor: "#FFFFFF",
    paddingTop: 0,
    paddingBottom: 60,
    paddingHorizontal: 0,
  },
  // Cover section
  cover: {
    backgroundColor: NAVY,
    paddingHorizontal: 48,
    paddingTop: 48,
    paddingBottom: 36,
    marginBottom: 0,
  },
  coverGoldLine: {
    width: 40,
    height: 3,
    backgroundColor: GOLD,
    marginBottom: 16,
  },
  coverTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "#FFFFFF",
    letterSpacing: 1,
    marginBottom: 6,
  },
  coverSubtitle: {
    fontSize: 11,
    color: GOLD,
    letterSpacing: 2,
    marginBottom: 24,
  },
  coverInfoRow: {
    flexDirection: "row",
    gap: 24,
    marginTop: 4,
  },
  coverInfoLabel: {
    fontSize: 8,
    color: "#9CA3AF",
    marginBottom: 2,
  },
  coverInfoValue: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: 700,
  },
  coverDate: {
    fontSize: 8,
    color: "#9CA3AF",
    marginTop: 20,
  },
  // Content area
  content: {
    paddingHorizontal: 48,
    paddingTop: 24,
  },
  // Section
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 8,
  },
  sectionNumber: {
    fontSize: 20,
    fontWeight: 700,
    color: GOLD,
    marginRight: 10,
    minWidth: 28,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: NAVY,
    flex: 1,
  },
  // Subtitle
  subTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: NAVY,
    marginTop: 12,
    marginBottom: 6,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: GOLD,
  },
  // Text
  text: {
    fontSize: 9,
    lineHeight: 1.7,
    color: TEXT,
    marginBottom: 4,
  },
  // Bullet
  bulletItem: {
    flexDirection: "row",
    marginBottom: 3,
    paddingLeft: 4,
  },
  bullet: {
    width: 14,
    fontSize: 9,
    color: GOLD,
    fontWeight: 700,
  },
  bulletText: {
    flex: 1,
    fontSize: 9,
    lineHeight: 1.6,
    color: TEXT,
  },
  // Table
  table: {
    marginVertical: 8,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 2,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: NAVY,
    paddingVertical: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingVertical: 5,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingVertical: 5,
    backgroundColor: BG,
  },
  tableCellHeader: {
    flex: 1,
    fontSize: 8,
    fontWeight: 700,
    color: "#FFFFFF",
    paddingHorizontal: 6,
  },
  tableCell: {
    flex: 1,
    fontSize: 8,
    color: TEXT,
    paddingHorizontal: 6,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 10,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  footerLogo: {
    fontSize: 8,
    fontWeight: 700,
    color: NAVY,
    letterSpacing: 1,
  },
  footerSub: {
    fontSize: 7,
    color: SUB,
  },
  footerPage: {
    fontSize: 7,
    color: SUB,
  },
  // Divider
  divider: {
    height: 2,
    backgroundColor: GOLD,
    width: 30,
    marginVertical: 12,
  },
});

type ContentItem =
  | { type: "subtitle"; text: string }
  | { type: "text"; text: string }
  | { type: "bullet"; text: string }
  | { type: "table"; rows: string[][] };

function parseMarkdown(md: string) {
  const lines = md.split("\n");
  const sections: { title: string; content: ContentItem[] }[] = [];
  let current: { title: string; content: ContentItem[] } | null = null;
  let tableRows: string[][] = [];
  let inTable = false;

  const flushTable = () => {
    if (inTable && tableRows.length > 0 && current) {
      current.content.push({ type: "table", rows: tableRows });
      tableRows = [];
      inTable = false;
    }
  };

  for (const line of lines) {
    if (line.match(/^##\s+/)) {
      flushTable();
      if (current) sections.push(current);
      current = { title: line.replace(/^#+\s+/, "").replace(/\*\*/g, ""), content: [] };
      continue;
    }
    if (!current) {
      if (line.match(/^#\s+/)) {
        current = { title: line.replace(/^#+\s+/, "").replace(/\*\*/g, ""), content: [] };
      }
      continue;
    }
    if (line.match(/^###\s+/)) {
      flushTable();
      current.content.push({ type: "subtitle", text: line.replace(/^#+\s+/, "").replace(/\*\*/g, "") });
      continue;
    }
    if (line.includes("|") && line.trim().startsWith("|")) {
      const cells = line.split("|").filter((c) => c.trim()).map((c) => c.trim().replace(/\*\*/g, ""));
      if (cells.some((c) => c.match(/^[-:]+$/))) continue;
      tableRows.push(cells);
      inTable = true;
      continue;
    } else {
      flushTable();
    }
    if (line.match(/^[-*]\s+/)) {
      current.content.push({ type: "bullet", text: line.replace(/^[-*]\s+/, "").replace(/\*\*/g, "") });
      continue;
    }
    if (line.match(/^\d+\.\s+/)) {
      current.content.push({ type: "bullet", text: line.replace(/^\d+\.\s+/, "").replace(/\*\*/g, "") });
      continue;
    }
    const trimmed = line.trim();
    if (trimmed) {
      current.content.push({ type: "text", text: trimmed.replace(/\*\*/g, "") });
    }
  }
  flushTable();
  if (current) sections.push(current);
  return sections;
}

function StudioPDF({
  title, clientName, businessType, area, month, content, type,
}: {
  title: string; clientName: string; businessType: string; area: string;
  month: string; content: string; type: string;
}) {
  const sections = parseMarkdown(content);
  const now = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
  const typeLabel = type === "SNS_PLAN" ? "SNS OPERATION PLAN" : type === "REPORT" ? "MONTHLY REPORT" : "PRODUCTION";

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Cover Header */}
        <View style={s.cover}>
          <View style={s.coverGoldLine} />
          <Text style={s.coverSubtitle}>{typeLabel}</Text>
          <Text style={s.coverTitle}>{title}</Text>
          <View style={s.coverInfoRow}>
            <View>
              <Text style={s.coverInfoLabel}>CLIENT</Text>
              <Text style={s.coverInfoValue}>{clientName}</Text>
            </View>
            <View>
              <Text style={s.coverInfoLabel}>INDUSTRY</Text>
              <Text style={s.coverInfoValue}>{businessType}</Text>
            </View>
            <View>
              <Text style={s.coverInfoLabel}>AREA</Text>
              <Text style={s.coverInfoValue}>{area}</Text>
            </View>
            <View>
              <Text style={s.coverInfoLabel}>PERIOD</Text>
              <Text style={s.coverInfoValue}>{month}</Text>
            </View>
          </View>
          <Text style={s.coverDate}>Prepared by Ad Arch Studio — {now}</Text>
        </View>

        {/* Content */}
        <View style={s.content}>
          {sections.map((section, si) => (
            <View key={si} style={s.section} wrap={false}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionNumber}>{String(si + 1).padStart(2, "0")}</Text>
                <Text style={s.sectionTitle}>{section.title}</Text>
              </View>
              {section.content.map((item, ii) => {
                if (item.type === "subtitle") {
                  return <Text key={ii} style={s.subTitle}>{item.text}</Text>;
                }
                if (item.type === "text") {
                  return <Text key={ii} style={s.text}>{item.text}</Text>;
                }
                if (item.type === "bullet") {
                  return (
                    <View key={ii} style={s.bulletItem}>
                      <Text style={s.bullet}>―</Text>
                      <Text style={s.bulletText}>{item.text}</Text>
                    </View>
                  );
                }
                if (item.type === "table" && item.rows.length > 0) {
                  return (
                    <View key={ii} style={s.table}>
                      {item.rows.map((row, ri) => (
                        <View key={ri} style={ri === 0 ? s.tableHeader : ri % 2 === 0 ? s.tableRowAlt : s.tableRow}>
                          {row.map((cell, ci) => (
                            <Text key={ci} style={ri === 0 ? s.tableCellHeader : s.tableCell}>
                              {cell}
                            </Text>
                          ))}
                        </View>
                      ))}
                    </View>
                  );
                }
                return null;
              })}
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <View style={s.footerLeft}>
            <Text style={s.footerLogo}>Ad Arch Studio</Text>
            <Text style={s.footerSub}>|</Text>
            <Text style={s.footerSub}>{clientName}</Text>
          </View>
          <Text style={s.footerSub}>CONFIDENTIAL</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} style={s.footerPage} />
        </View>
      </Page>
    </Document>
  );
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const productionId = searchParams.get("id");
  if (!productionId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const production = await prisma.production.findUnique({
    where: { id: productionId },
    include: { studioClient: true },
  });
  if (!production) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await renderToBuffer(
    React.createElement(StudioPDF, {
      title: production.title,
      clientName: production.studioClient.name,
      businessType: production.studioClient.businessType,
      area: production.studioClient.area,
      month: production.month || "",
      content: production.content,
      type: production.type,
    })
  );

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(production.title)}.pdf"`,
    },
  });
}
