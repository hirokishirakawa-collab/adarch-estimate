// ==============================================================
// 取引先マップ（/dashboard/clients）に渡す1社分のデータを組み立てる
// ==============================================================

import { db } from "@/lib/db";
import { ARCHIVE_BRANCH_ID, BRANCH_MAP } from "@/lib/data/customers";
import {
  formatCapital,
  industryGroup,
  parsePrefecture,
  ratingBand,
  regionOf,
  sizeBand,
  type RatingBand,
  type SizeBand,
} from "./normalize";

export interface ClientWorkRow {
  id: string;
  /** works_site（旧サイト・サムネあり）／ drive（Drive実績フォルダ・リンクのみ） */
  source: string;
  title: string;
  titleJp: string | null;
  category: string;
  year: number;
  thumbnail: string | null;
  videoUrl: string | null;
  driveUrl: string | null;
  fileCount: number | null;
}

export interface ClientRow {
  id: string;
  name: string;
  status: "ACTIVE" | "PROSPECT" | "INACTIVE";
  industry: string | null;
  industryGroup: string;
  prefecture: string | null;
  region: string;
  branchId: string;
  branchName: string;
  website: string | null;
  /** 取引中・制作実績あり・プロジェクトあり のいずれか */
  proven: boolean;
  projectCount: number;
  works: ClientWorkRow[];
  /** いちばん新しい実績の年（Drive由来はフォルダの最終更新年）。実績が無ければ null */
  latestYear: number | null;
  /** 実績数＝旧サイト実績は1本ずつ、Drive由来は配下の制作物ファイル数（動画・画像・PDF） */
  worksCount: number;

  rating: number | null;
  ratingCount: number | null;
  ratingBand: RatingBand;
  mapsUrl: string | null;
  placeName: string | null;
  placeAddress: string | null;
  placeSummary: string | null;
  placeChecked: boolean;
  lat: number | null;
  lng: number | null;
  hasPhoto: boolean;

  employeeCount: number | null;
  sizeBand: SizeBand;
  capital: string | null;
  representativeName: string | null;
  foundedYear: number | null;
  foundedRaw: string | null;
  profileSource: string | null;
  profileSourceUrl: string | null;
  profileChecked: boolean;

  /** 顧客管理の詳細ページを開ける（本部か自拠点の顧客） */
  canOpen: boolean;
  /** 旧サイト・Drive の実績から起こした会社（データ未整備）。通常の顧客とは別扱い */
  isArchive: boolean;
}

/** 1行分の実績数。Drive由来は配下の制作物ファイル数（0なら1として数える） */
export function workCount(w: { source: string; fileCount: number | null }): number {
  return w.source === "drive" ? Math.max(w.fileCount ?? 0, 1) : 1;
}

export async function loadClientRows(viewer: {
  role: string;
  branchIds: string[];
}): Promise<ClientRow[]> {
  const [customers, branches] = await Promise.all([
    db.customer.findMany({
      where: { status: { not: "BLOCKED" } },
      select: {
        id: true, name: true, status: true, industry: true, prefecture: true, address: true, branchId: true, website: true,
        googleRating: true, googleRatingCount: true, googleMapsUrl: true, placeName: true, placeAddress: true,
        placeSummary: true, placeCheckedAt: true, lat: true, lng: true, photoSource: true,
        employeeCount: true, capital: true, representativeName: true, foundedYear: true, foundedRaw: true,
        profileSource: true, profileSourceUrl: true, profileCheckedAt: true,
        _count: { select: { projects: true } },
        clientWorks: {
          select: { id: true, source: true, title: true, titleJp: true, category: true, year: true, thumbnail: true, videoUrl: true, driveUrl: true, fileCount: true },
          // サムネのある旧サイト実績を先に、その中で新しい順
          orderBy: [{ source: "desc" }, { year: "desc" }],
        },
      },
      orderBy: { name: "asc" },
    }),
    db.branch.findMany({ select: { id: true, name: true } }),
  ]);

  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const isAdmin = viewer.role === "ADMIN";

  return customers.map((c) => {
    const prefecture = c.prefecture || parsePrefecture(c.placeAddress) || parsePrefecture(c.address);
    const proven = c.status === "ACTIVE" || c.clientWorks.length > 0 || c._count.projects > 0;
    return {
      id: c.id,
      name: c.name,
      status: c.status as ClientRow["status"],
      industry: c.industry,
      industryGroup: industryGroup(c.industry),
      prefecture,
      region: regionOf(prefecture),
      branchId: c.branchId,
      branchName: BRANCH_MAP[c.branchId as keyof typeof BRANCH_MAP]?.name ?? branchName.get(c.branchId) ?? "不明",
      website: c.website,
      proven,
      projectCount: c._count.projects,
      works: c.clientWorks,
      latestYear: c.clientWorks.length ? Math.max(...c.clientWorks.map((w) => w.year)) : null,
      worksCount: c.clientWorks.reduce((n, w) => n + workCount(w), 0),
      rating: c.googleRating,
      ratingCount: c.googleRatingCount,
      ratingBand: ratingBand(c.googleRating, c.googleRatingCount),
      mapsUrl: c.googleMapsUrl,
      placeName: c.placeName,
      placeAddress: c.placeAddress,
      placeSummary: c.placeSummary,
      placeChecked: c.placeCheckedAt !== null,
      lat: c.lat,
      lng: c.lng,
      hasPhoto: c.photoSource !== null,
      employeeCount: c.employeeCount,
      sizeBand: sizeBand(c.employeeCount),
      capital: formatCapital(c.capital),
      representativeName: c.representativeName,
      foundedYear: c.foundedYear,
      foundedRaw: c.foundedRaw,
      profileSource: c.profileSource,
      profileSourceUrl: c.profileSourceUrl,
      profileChecked: c.profileCheckedAt !== null,
      canOpen: isAdmin || viewer.branchIds.includes(c.branchId),
      isArchive: c.branchId === ARCHIVE_BRANCH_ID,
    };
  });
}
