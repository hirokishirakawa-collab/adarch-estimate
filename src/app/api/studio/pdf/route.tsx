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

// Noto Sans JP for Japanese text
Font.register({
  family: "NotoSansJP",
  fonts: [
    { src: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.0.1/files/noto-sans-jp-japanese-400-normal.woff", fontWeight: 400 },
    { src: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.0.1/files/noto-sans-jp-japanese-700-normal.woff", fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 9,
    padding: 40,
    color: "#1a1a2e",
    backgroundColor: "#ffffff",
  },
  header: {
    backgroundColor: "#1a1a2e",
    color: "#ffffff",
    padding: 20,
    marginBottom: 20,
    marginTop: -40,
    marginLeft: -40,
    marginRight: -40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 10,
    color: "#9ca3af",
    marginTop: 4,
  },
  clientInfo: {
    flexDirection: "row",
    marginTop: 8,
    gap: 20,
  },
  clientInfoItem: {
    fontSize: 9,
    color: "#d1d5db",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#1a1a2e",
    borderBottomWidth: 2,
    borderBottomColor: "#7c3aed",
    paddingBottom: 4,
    marginTop: 20,
    marginBottom: 10,
  },
  subTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#374151",
    marginTop: 12,
    marginBottom: 6,
  },
  text: {
    fontSize: 9,
    lineHeight: 1.6,
    color: "#374151",
    marginBottom: 4,
  },
  bulletItem: {
    flexDirection: "row",
    marginBottom: 3,
    paddingLeft: 8,
  },
  bullet: {
    width: 12,
    fontSize: 9,
    color: "#7c3aed",
  },
  bulletText: {
    flex: 1,
    fontSize: 9,
    lineHeight: 1.5,
    color: "#374151",
  },
  table: {
    marginTop: 6,
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingVertical: 5,
  },
  tableCell: {
    flex: 1,
    fontSize: 8,
    color: "#374151",
    paddingHorizontal: 4,
  },
  tableCellHeader: {
    flex: 1,
    fontSize: 8,
    fontWeight: 700,
    color: "#1f2937",
    paddingHorizontal: 4,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: "#9ca3af",
  },
  badge: {
    backgroundColor: "#ede9fe",
    color: "#7c3aed",
    fontSize: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
});

// Markdown → 構造化データ
function parseMarkdown(md: string) {
  const lines = md.split("\n");
  const sections: { title: string; content: ContentItem[] }[] = [];
  let currentSection: { title: string; content: ContentItem[] } | null = null;

  type ContentItem =
    | { type: "subtitle"; text: string }
    | { type: "text"; text: string }
    | { type: "bullet"; text: string }
    | { type: "table"; rows: string[][] };

  let tableRows: string[][] = [];
  let inTable = false;

  for (const line of lines) {
    // Section header (## )
    if (line.match(/^##\s+/)) {
      if (currentSection) sections.push(currentSection);
      currentSection = { title: line.replace(/^#+\s+/, ""), content: [] };
      inTable = false;
      continue;
    }

    if (!currentSection) {
      if (line.match(/^#\s+/)) {
        currentSection = { title: line.replace(/^#+\s+/, ""), content: [] };
      }
      continue;
    }

    // Subtitle (### )
    if (line.match(/^###\s+/)) {
      if (inTable && tableRows.length > 0) {
        currentSection.content.push({ type: "table", rows: tableRows });
        tableRows = [];
        inTable = false;
      }
      currentSection.content.push({ type: "subtitle", text: line.replace(/^#+\s+/, "") });
      continue;
    }

    // Table row
    if (line.includes("|") && line.trim().startsWith("|")) {
      const cells = line.split("|").filter((c) => c.trim()).map((c) => c.trim());
      if (cells.some((c) => c.match(/^[-:]+$/))) continue; // separator
      tableRows.push(cells);
      inTable = true;
      continue;
    } else if (inTable && tableRows.length > 0) {
      currentSection.content.push({ type: "table", rows: tableRows });
      tableRows = [];
      inTable = false;
    }

    // Bullet
    if (line.match(/^[-*]\s+/)) {
      currentSection.content.push({ type: "bullet", text: line.replace(/^[-*]\s+/, "").replace(/\*\*(.*?)\*\*/g, "$1") });
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\.\s+/)) {
      currentSection.content.push({ type: "bullet", text: line.replace(/^\d+\.\s+/, "").replace(/\*\*(.*?)\*\*/g, "$1") });
      continue;
    }

    // Regular text
    const trimmed = line.trim();
    if (trimmed) {
      currentSection.content.push({ type: "text", text: trimmed.replace(/\*\*(.*?)\*\*/g, "$1") });
    }
  }

  if (inTable && tableRows.length > 0 && currentSection) {
    currentSection.content.push({ type: "table", rows: tableRows });
  }
  if (currentSection) sections.push(currentSection);

  return sections;
}

// PDF Document Component
function StudioPDF({
  title,
  clientName,
  businessType,
  area,
  month,
  content,
  type,
}: {
  title: string;
  clientName: string;
  businessType: string;
  area: string;
  month: string;
  content: string;
  type: string;
}) {
  const sections = parseMarkdown(content);
  const now = new Date().toLocaleDateString("ja-JP");
  const typeLabel = type === "SNS_PLAN" ? "SNS運用プラン" : type === "REPORT" ? "月次レポート" : type;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ad Arch Studio</Text>
          <Text style={styles.headerSubtitle}>{typeLabel}</Text>
          <View style={styles.clientInfo}>
            <Text style={styles.clientInfoItem}>{clientName}</Text>
            <Text style={styles.clientInfoItem}>{businessType}</Text>
            <Text style={styles.clientInfoItem}>{area}</Text>
            <Text style={styles.clientInfoItem}>{month}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "#1a1a2e" }}>
          {title}
        </Text>

        {/* Sections */}
        {sections.map((section, si) => (
          <View key={si} wrap={false}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.content.map((item, ii) => {
              if (item.type === "subtitle") {
                return <Text key={ii} style={styles.subTitle}>{item.text}</Text>;
              }
              if (item.type === "text") {
                return <Text key={ii} style={styles.text}>{item.text}</Text>;
              }
              if (item.type === "bullet") {
                return (
                  <View key={ii} style={styles.bulletItem}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.bulletText}>{item.text}</Text>
                  </View>
                );
              }
              if (item.type === "table" && item.rows.length > 0) {
                return (
                  <View key={ii} style={styles.table}>
                    {item.rows.map((row, ri) => (
                      <View key={ri} style={ri === 0 ? styles.tableHeader : styles.tableRow}>
                        {row.map((cell, ci) => (
                          <Text key={ci} style={ri === 0 ? styles.tableCellHeader : styles.tableCell}>
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

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Ad Arch Studio | {clientName}</Text>
          <Text style={styles.footerText}>作成日: {now}</Text>
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
