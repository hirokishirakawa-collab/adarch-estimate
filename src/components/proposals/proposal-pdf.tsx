// このファイルはサーバー専用（API ルートから呼び出す）
// @react-pdf/renderer は Node.js でのみ動作します

import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { C, COMPANY, LOGO_PATH } from "@/components/pdf/theme";
import { PdfFooter } from "@/components/pdf/pdf-kit";

interface ProposalContent {
  cover: { title: string; subtitle: string; date: string; to: string };
  companyIntro: { heading: string; description: string; strengths: string[] };
  proposal: {
    heading: string;
    challenge: string;
    solutions: { title: string; description: string }[];
  };
  cases: { heading: string; items: { title: string; description: string }[] };
  nextSteps: { heading: string; steps: string[]; contact: string };
  styleOverrides?: { [key: string]: { fontScale?: number } };
}

const s = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    paddingHorizontal: 50,
    paddingTop: 44,
    paddingBottom: 52,
    fontSize: 10,
    color: C.body,
    backgroundColor: C.white,
  },
  // Cover
  coverPage: {
    fontFamily: "NotoSansJP",
    paddingHorizontal: 50,
    paddingVertical: 40,
    backgroundColor: C.white,
    justifyContent: "center",
    alignItems: "center",
  },
  coverLogo: { width: 132, height: 33, marginBottom: 48 },
  coverTo: { fontSize: 11, color: C.mid, marginBottom: 28 },
  coverTitle: { fontSize: 26, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.ink, textAlign: "center", marginBottom: 8 },
  coverSubtitle: { fontSize: 12, color: C.mid, textAlign: "center", marginBottom: 36 },
  coverLine: { width: 56, height: 2, backgroundColor: C.accent, marginBottom: 36 },
  coverDate: { fontSize: 10, color: C.faint, marginBottom: 6 },
  coverFrom: { fontSize: 11, color: C.ink, fontFamily: "NotoSansJP", fontWeight: "bold" },
  // Section
  sectionHeading: {
    fontSize: 16,
    fontFamily: "NotoSansJP",
    fontWeight: "bold",
    color: C.ink,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1.2,
    borderBottomColor: C.accent,
  },
  paragraph: { fontSize: 10, lineHeight: 1.8, color: C.body, marginBottom: 12 },
  // Strengths
  strengthsRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  strengthBox: { flex: 1, backgroundColor: C.accentSoft, padding: 12, borderRadius: 4, alignItems: "center" },
  strengthText: { fontSize: 9, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.accent, textAlign: "center" },
  // Challenge box
  challengeBox: { backgroundColor: C.rowAlt, padding: 14, borderRadius: 4, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: C.accent },
  challengeText: { fontSize: 10, color: C.body, lineHeight: 1.7 },
  // Solution card
  solutionCard: { borderWidth: 1, borderColor: C.line, borderRadius: 4, padding: 14, marginBottom: 10 },
  solutionTitle: { fontSize: 11, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.ink, marginBottom: 6 },
  solutionDesc: { fontSize: 9, color: C.mid, lineHeight: 1.7 },
  // Case item
  caseItem: { backgroundColor: C.rowAlt, padding: 14, borderRadius: 4, marginBottom: 10 },
  caseTitle: { fontSize: 10, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.body, marginBottom: 4 },
  caseDesc: { fontSize: 9, color: C.mid, lineHeight: 1.7 },
  // Steps
  stepRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10, gap: 10 },
  stepNumber: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  stepNumberText: { fontSize: 9, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.white },
  stepText: { flex: 1, fontSize: 10, color: C.body, lineHeight: 1.7, paddingTop: 3 },
  contactText: { fontSize: 10, color: C.mid, textAlign: "center", marginTop: 30 },
});

interface Props {
  content: ProposalContent;
}

// フォントサイズにスケールを適用
function sf(base: number, scale: number): number {
  return Math.round(base * scale * 10) / 10;
}

// 自動スケール計算（Web側と同じロジック）
function calcAutoScale(sectionKey: string, content: ProposalContent): number {
  switch (sectionKey) {
    case "companyIntro": {
      const chars = content.companyIntro.description.length + content.companyIntro.strengths.join("").length;
      const count = content.companyIntro.strengths.length;
      if (count > 5 || chars > 400) return 0.75;
      if (count > 4 || chars > 300) return 0.82;
      if (count > 3 || chars > 200) return 0.9;
      return 1;
    }
    case "proposal": {
      const chars = content.proposal.challenge.length + content.proposal.solutions.reduce((a, sol) => a + sol.title.length + sol.description.length, 0);
      const count = content.proposal.solutions.length;
      if (count > 5 || chars > 600) return 0.7;
      if (count > 4 || chars > 450) return 0.78;
      if (count > 3 || chars > 300) return 0.85;
      if (count > 2 || chars > 200) return 0.92;
      return 1;
    }
    case "cases": {
      const chars = content.cases.items.reduce((a, item) => a + item.title.length + item.description.length, 0);
      const count = content.cases.items.length;
      if (count > 6 || chars > 500) return 0.7;
      if (count > 4 || chars > 400) return 0.78;
      if (count > 3 || chars > 250) return 0.85;
      if (count > 2 || chars > 150) return 0.92;
      return 1;
    }
    case "nextSteps": {
      const chars = content.nextSteps.steps.join("").length + content.nextSteps.contact.length;
      const count = content.nextSteps.steps.length;
      if (count > 6 || chars > 400) return 0.78;
      if (count > 5 || chars > 300) return 0.85;
      if (count > 4 || chars > 200) return 0.92;
      return 1;
    }
    default:
      return 1;
  }
}

function getScale(sectionKey: string, content: ProposalContent): number {
  const manual = content.styleOverrides?.[sectionKey]?.fontScale;
  if (manual !== undefined) return manual;
  return calcAutoScale(sectionKey, content);
}

export function ProposalPdfDocument({ content }: Props) {
  const c = content;

  const introScale = getScale("companyIntro", c);
  const proposalScale = getScale("proposal", c);
  const casesScale = getScale("cases", c);
  const stepsScale = getScale("nextSteps", c);

  const FOOTER = "Ad Arch Group";

  return (
    <Document title={c.cover.title} author="Ad Arch株式会社" creator="Ad Arch Group OS">
      {/* Page 1: Cover */}
      <Page size="A4" style={s.coverPage}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={LOGO_PATH} style={s.coverLogo} />
        <Text style={s.coverTo}>{c.cover.to}</Text>
        <Text style={s.coverTitle}>{c.cover.title}</Text>
        <Text style={s.coverSubtitle}>{c.cover.subtitle}</Text>
        <View style={s.coverLine} />
        <Text style={s.coverDate}>{c.cover.date}</Text>
        <Text style={s.coverFrom}>{COMPANY.name}</Text>
      </Page>

      {/* Page 2: Company Intro */}
      <Page size="A4" style={s.page}>
        <Text style={[s.sectionHeading, { fontSize: sf(16, introScale) }]}>{c.companyIntro.heading}</Text>
        <Text style={[s.paragraph, { fontSize: sf(10, introScale) }]}>{c.companyIntro.description}</Text>
        <View style={s.strengthsRow}>
          {c.companyIntro.strengths.map((str, i) => (
            <View key={i} style={s.strengthBox}>
              <Text style={[s.strengthText, { fontSize: sf(9, introScale) }]}>{str}</Text>
            </View>
          ))}
        </View>
        <PdfFooter label={FOOTER} />
      </Page>

      {/* Page 3: Proposal */}
      <Page size="A4" style={s.page}>
        <Text style={[s.sectionHeading, { fontSize: sf(16, proposalScale) }]}>{c.proposal.heading}</Text>
        <View style={s.challengeBox}>
          <Text style={[s.challengeText, { fontSize: sf(10, proposalScale) }]}>{c.proposal.challenge}</Text>
        </View>
        {c.proposal.solutions.map((sol, i) => (
          <View key={i} style={[s.solutionCard, { padding: Math.round(14 * proposalScale) }]}>
            <Text style={[s.solutionTitle, { fontSize: sf(11, proposalScale) }]}>{sol.title}</Text>
            <Text style={[s.solutionDesc, { fontSize: sf(9, proposalScale) }]}>{sol.description}</Text>
          </View>
        ))}
        <PdfFooter label={FOOTER} />
      </Page>

      {/* Page 4: Cases */}
      <Page size="A4" style={s.page}>
        <Text style={[s.sectionHeading, { fontSize: sf(16, casesScale) }]}>{c.cases.heading}</Text>
        {c.cases.items.map((item, i) => (
          <View key={i} style={[s.caseItem, { padding: Math.round(14 * casesScale) }]}>
            <Text style={[s.caseTitle, { fontSize: sf(10, casesScale) }]}>{item.title}</Text>
            <Text style={[s.caseDesc, { fontSize: sf(9, casesScale) }]}>{item.description}</Text>
          </View>
        ))}
        <PdfFooter label={FOOTER} />
      </Page>

      {/* Page 5: Next Steps */}
      <Page size="A4" style={s.page}>
        <Text style={[s.sectionHeading, { fontSize: sf(16, stepsScale) }]}>{c.nextSteps.heading}</Text>
        {c.nextSteps.steps.map((step, i) => (
          <View key={i} style={s.stepRow}>
            <View style={s.stepNumber}>
              <Text style={[s.stepNumberText, { fontSize: sf(9, stepsScale) }]}>{i + 1}</Text>
            </View>
            <Text style={[s.stepText, { fontSize: sf(10, stepsScale) }]}>{step}</Text>
          </View>
        ))}
        <Text style={[s.contactText, { fontSize: sf(10, stepsScale) }]}>{c.nextSteps.contact}</Text>
        <PdfFooter label={FOOTER} />
      </Page>
    </Document>
  );
}
