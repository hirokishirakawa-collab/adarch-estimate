import {
  BookOpen, BookUser, BriefcaseBusiness, CalendarDays, ChartNoAxesCombined,
  Clapperboard, Compass, FileCheck2, FileText, FolderOpen, Handshake,
  Images, Mail, MapPin, MessageCircle, Package, ReceiptText, Search,
  Send, Sparkles, Users, Video, type LucideIcon,
} from "lucide-react";
import type { NavigationGroup } from "@/lib/navigation/catalog";

type HubFeature = { href: string; verb: string; description: string; icon: LucideIcon };
type HubTheme = { english: string; invitation: string; features: HubFeature[] };

export const HUB_THEMES: Partial<Record<NavigationGroup, HubTheme>> = {
  sales: {
    english: "MAKE THE NEXT CONNECTION",
    invitation: "次の出会いを、次の仕事へ。",
    features: [
      { href: "/dashboard/leads/list", verb: "出会う", description: "気になる相手と、最初の一歩。", icon: Compass },
      { href: "/dashboard/customers", verb: "話を進める", description: "これまでの会話から、続きを。", icon: BookUser },
      { href: "/dashboard/leads/awaiting", verb: "次につなぐ", description: "届いた返事を、次のチャンスに。", icon: MessageCircle },
    ],
  },
  projects: {
    english: "GOOD IDEAS, INTO THE WORLD",
    invitation: "一緒につくる。世の中へ届ける。",
    features: [
      { href: "/dashboard/projects", verb: "つくる", description: "進んでいる仕事の続きを。", icon: Clapperboard },
      { href: "/dashboard/tver", verb: "届ける", description: "広告主の考査から配信まで。", icon: Video },
      { href: "/dashboard/creators", verb: "つながる", description: "一緒につくる仲間を見つける。", icon: Users },
    ],
  },
  library: {
    english: "OPEN A NEW POSSIBILITY",
    invitation: "いい提案は、いい材料から。",
    features: [
      { href: "/dashboard/library", verb: "見つける", description: "資料も事例も、ひとつの検索で。", icon: Search },
      { href: "/dashboard/packages", verb: "組み立てる", description: "お客様に合う提案のかたちを。", icon: Package },
      { href: "/dashboard/portfolio", verb: "ひらめく", description: "仲間の実績を、次のアイデアに。", icon: Images },
    ],
  },
  procedures: {
    english: "CLEAR THE DESK, MOVE AHEAD",
    invitation: "すっきり整えて、次の仕事へ。",
    features: [
      { href: "/dashboard/procedures", verb: "確認する", description: "自社の提出と、本部からの連絡。", icon: FileCheck2 },
      { href: "/dashboard/sales-report", verb: "報告する", description: "今月の仕事を、自分の記録に。", icon: CalendarDays },
      { href: "/dashboard/billing", verb: "依頼する", description: "終えた仕事を、請求へつなぐ。", icon: ReceiptText },
    ],
  },
};

/** Decorative shapes only: no figures, states or customer data are represented. */
export function HubIllustration({ group }: { group: NavigationGroup }) {
  return (
    <svg className={`os-hub-art os-hub-art-${group}`} viewBox="0 0 420 230" fill="none" aria-hidden="true" focusable="false">
      <ellipse cx="223" cy="191" rx="150" ry="19" fill="#e6e4e0" opacity=".38" />
      <circle cx="216" cy="109" r="91" stroke="#e6e4e0" strokeDasharray="3 7" />
      <path d="M39 137H72M56 120V153M351 47H373M362 36V58" stroke="#b8b8b4" strokeWidth="1.5" />
      {group === "sales" && <>
        <path d="M86 170C110 184 125 111 176 123S277 127 323 63" stroke="#b8b8b4" strokeWidth="1.5" strokeDasharray="4 5" />
        <g className="os-art-back" transform="rotate(-11 164 96)">
          <rect x="101" y="38" width="139" height="108" rx="5" fill="white" stroke="#111" strokeWidth="1.5" />
          <path d="M101 62H240" stroke="#e6e4e0" /><circle cx="114" cy="50" r="2" fill="#111" /><circle cx="123" cy="50" r="2" fill="#b8b8b4" />
          <circle cx="130" cy="89" r="10" stroke="#111" strokeWidth="1.5" /><path d="M116 115C116 99 144 99 144 115M158 85H217M158 96H199M116 129H217" stroke="#b8b8b4" strokeWidth="2" />
        </g>
        <g className="os-art-front" transform="rotate(8 271 136)">
          <path d="M223 90H321V161H271L247 180V161H223V90Z" fill="#111" />
          <circle cx="249" cy="123" r="4" fill="white" /><circle cx="272" cy="123" r="4" fill="white" /><circle cx="295" cy="123" r="4" fill="white" />
        </g>
        <g className="os-art-accent"><circle cx="302" cy="59" r="28" fill="#f19834" /><path d="M290 60H313M303 50L313 60L303 70" stroke="#111" strokeWidth="2" /></g>
      </>}
      {group === "projects" && <>
        <g className="os-art-back" transform="rotate(-10 160 106)">
          <rect x="97" y="47" width="132" height="127" rx="4" fill="white" stroke="#111" strokeWidth="1.5" />
          <path d="M113 67H171M113 81H205M113 96H192" stroke="#b8b8b4" strokeWidth="2" />
          <path d="M113 118H143V150H113V118ZM153 118H205V150H153V118Z" stroke="#111" strokeWidth="1.5" />
        </g>
        <g className="os-art-front" transform="rotate(7 270 121)">
          <rect x="214" y="71" width="123" height="104" rx="4" fill="#111" /><path d="M214 95H337" stroke="#6a6a6a" /><path d="M230 71L245 95M260 71L275 95M290 71L305 95M320 71L335 95" stroke="#f7f6f4" strokeWidth="6" />
          <path d="M265 116L287 129L265 143V116Z" fill="white" />
        </g>
        <g className="os-art-accent"><circle cx="302" cy="49" r="27" fill="#f19834" /><path d="M289 50L299 59L315 40" stroke="#111" strokeWidth="2" /></g>
      </>}
      {group === "library" && <>
        <g className="os-art-back" transform="rotate(-13 153 111)">
          <rect x="94" y="48" width="117" height="132" rx="4" fill="white" stroke="#111" strokeWidth="1.5" /><path d="M110 71H194M110 84H162" stroke="#b8b8b4" strokeWidth="2" />
          <rect x="110" y="102" width="84" height="57" fill="#f7f6f4" /><path d="M115 151L141 122L160 143L174 131L190 151" stroke="#111" strokeWidth="1.5" /><circle cx="178" cy="115" r="5" fill="#b8b8b4" />
        </g>
        <g className="os-art-front" transform="rotate(7 259 123)">
          <path d="M219 62H302V185H219V62Z" fill="#111" /><path d="M234 62V185M247 84H285M247 95H273" stroke="#6a6a6a" strokeWidth="1.5" /><path d="M269 128L282 137L269 146Z" fill="white" />
        </g>
        <g className="os-art-accent"><path d="M315 33L322 55L345 63L322 70L315 93L307 70L285 63L307 55L315 33Z" fill="#f19834" /></g>
      </>}
      {group === "procedures" && <>
        <g className="os-art-back" transform="rotate(-9 173 104)">
          <rect x="111" y="39" width="129" height="140" rx="4" fill="white" stroke="#111" strokeWidth="1.5" /><path d="M142 38V52M209 38V52M111 68H240" stroke="#111" strokeWidth="1.5" />
          <path d="M132 92L137 98L147 86M132 117L137 123L147 111M160 94H218M160 119H203M160 145H214" stroke="#b8b8b4" strokeWidth="2" /><rect x="132" y="138" width="12" height="12" stroke="#b8b8b4" />
        </g>
        <g className="os-art-front" transform="rotate(8 278 147)"><rect x="227" y="116" width="111" height="68" rx="3" fill="#111" /><path d="M230 119L282 152L335 119" stroke="white" strokeWidth="1.5" /></g>
        <g className="os-art-accent"><circle cx="298" cy="67" r="29" fill="#f19834" /><path d="M285 68L295 77L313 56" stroke="#111" strokeWidth="2" /></g>
      </>}
      <path d="M64 198H376" stroke="#e6e4e0" /><circle cx="354" cy="172" r="4" stroke="#b8b8b4" />
    </svg>
  );
}

export function hubItemIcon(href: string, label: string): LucideIcon {
  if (/AI|アドバイザー/.test(label)) return Sparkles;
  if (/tver|simulator|media/.test(href)) return Video;
  if (/status|report|review/.test(href)) return FileCheck2;
  if (/billing|payment|royalty|estimate/.test(href)) return ReceiptText;
  if (/mail|outreach|awaiting|\/dm/.test(href)) return Send;
  if (/profile|creator/.test(href)) return Users;
  if (/customer|business-card/.test(href)) return BookUser;
  if (/deal/.test(href)) return Handshake;
  if (/finder|leads/.test(href)) return Compass;
  if (/client/.test(href)) return MapPin;
  if (/package/.test(href)) return Package;
  if (/portfolio|vault|assets|brand-kit/.test(href)) return Images;
  if (/seminar|playlist/.test(href)) return Clapperboard;
  if (/wiki|learning|guide|playbook/.test(href)) return BookOpen;
  if (/insight|activity/.test(href)) return ChartNoAxesCombined;
  if (/project|regular/.test(href)) return BriefcaseBusiness;
  if (/calendar|booking/.test(href)) return CalendarDays;
  if (/violation|procedures/.test(href)) return MessageCircle;
  if (/drive/.test(href)) return FolderOpen;
  if (/line/.test(href)) return Mail;
  return FileText;
}
