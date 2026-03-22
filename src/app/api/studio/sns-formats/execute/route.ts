import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { NextResponse } from "next/server";

const CEP_BRIDGE_URL = "http://127.0.0.1:8847";

async function callCepBridge(endpoint: string, body?: object) {
  const opts: RequestInit = {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  };
  const res = await fetch(`${CEP_BRIDGE_URL}${endpoint}`, opts);
  return res.json();
}

async function executeJsx(code: string) {
  return callCepBridge("/execute", { code });
}

// ══════════════════════════════════════════
// Premiere Pro 自動編集パイプライン
// ══════════════════════════════════════════

async function runAutoEdit(order: {
  id: string;
  formatName: string;
  telopId: string | null;
  structure: any[];
  mediaPaths: string[] | null;
  bgmPath: string | null;
}) {
  const media = order.mediaPaths || [];
  if (media.length === 0) {
    throw new Error("素材ファイルが指定されていません");
  }

  // 1. Check Premiere connection
  const ping = await callCepBridge("/ping").catch(() => null);
  if (!ping || ping.status !== "ok") {
    throw new Error("Premiere Pro (CEP Bridge) に接続できません。Premiereを起動し、MCP Bridgeパネルを開いてください。");
  }

  // 2. Import media
  const importJsx = `
    var project = app.project;
    var paths = ${JSON.stringify(media)};
    var result = project.importFiles(paths, false, project.rootItem, false);
    return JSON.stringify({imported: result, count: paths.length});
  `;
  const importResult = await executeJsx(importJsx);
  if (!importResult.success) throw new Error("素材インポート失敗: " + JSON.stringify(importResult));

  // 3. Create sequence
  const seqName = `SNS_${order.formatName}_${Date.now()}`;
  const createSeqJsx = `
    var project = app.project;
    project.createNewSequence("${seqName}", "seq_${order.id}");
    var seq = project.activeSequence;
    return seq ? seq.name : "FAILED";
  `;
  const seqResult = await executeJsx(createSeqJsx);
  if (!seqResult.success || seqResult.result === "FAILED") {
    throw new Error("シーケンス作成失敗");
  }

  // 4. Place clips based on structure
  const structure = order.structure as { l: string; d: string; c: string }[];
  const slotStarts: number[] = [];
  let currentTime = 0;
  for (const slot of structure) {
    slotStarts.push(currentTime);
    currentTime += parseFloat(slot.d);
  }

  const placeJsx = `
    var seq = app.project.activeSequence;
    var root = app.project.rootItem;
    var videoTrack = seq.videoTracks[0];
    var audioTrack = seq.audioTracks[0];
    var clips = [];
    var bgmClip = null;
    for (var i = 0; i < root.children.numItems; i++) {
      var item = root.children[i];
      if (item.isSequence()) continue;
      if (item.name.match(/\\.(mp3|wav|aac)$/i)) {
        bgmClip = item;
      } else if (item.name.match(/\\.(mp4|mov|avi|mkv)$/i)) {
        clips.push(item);
      }
    }
    clips.sort(function(a, b) { return a.name < b.name ? -1 : 1; });
    var tps = 254016000000;
    var starts = ${JSON.stringify(slotStarts)};
    var placed = 0;
    for (var s = 0; s < Math.min(clips.length, starts.length); s++) {
      var startTicks = String(Math.round(starts[s] * tps));
      videoTrack.insertClip(clips[s], startTicks);
      placed++;
    }
    if (bgmClip) {
      audioTrack.insertClip(bgmClip, "0");
    }
    return JSON.stringify({placed: placed, bgm: bgmClip ? true : false});
  `;
  const placeResult = await executeJsx(placeJsx);
  if (!placeResult.success) throw new Error("クリップ配置失敗: " + JSON.stringify(placeResult));

  // 5. Add markers
  for (let i = 0; i < structure.length; i++) {
    const markerJsx = `
      var seq = app.project.activeSequence;
      var marker = seq.markers.createMarker(${slotStarts[i]});
      marker.name = "${structure[i].l}";
      marker.setColorByIndex(${i % 8});
      return "ok";
    `;
    await executeJsx(markerJsx);
  }

  // 6. Add telop (MOGRT) if available
  if (order.telopId) {
    const mogrtPath = "/Applications/Adobe Premiere Pro 2025/Adobe Premiere Pro 2025.app/Contents/Essential Graphics/Titles/Bold Title.mogrt";
    // Add telop on first slot (hook text)
    const telopJsx = `
      var seq = app.project.activeSequence;
      var mogrtPath = "${mogrtPath}";
      seq.importMGT(mogrtPath, "0", 1, 0);
      var track = seq.videoTracks[1];
      var clip = track.clips[track.clips.numItems - 1];
      var comps = clip.components;
      for (var i = 0; i < comps.numItems; i++) {
        if (comps[i].displayName === "テキスト") {
          for (var j = 0; j < comps[i].properties.numItems; j++) {
            if (comps[i].properties[j].displayName === "ソーステキスト") {
              comps[i].properties[j].setValue("${structure[0]?.l || ""}");
            }
          }
        }
      }
      return "ok";
    `;
    await executeJsx(telopJsx);
  }

  return { sequenceName: seqName, structure: structure.length, placed: placeResult.result };
}

// ══════════════════════════════════════════
// API Handler
// ══════════════════════════════════════════

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { orderId, mediaPaths, bgmPath } = await req.json();

  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  const order = await prisma.snsFormatOrder.findUnique({
    where: { id: orderId },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Update media paths if provided
  if (mediaPaths) {
    await prisma.snsFormatOrder.update({
      where: { id: orderId },
      data: { mediaPaths, bgmPath: bgmPath || null },
    });
  }

  // Update status to PROCESSING
  await prisma.snsFormatOrder.update({
    where: { id: orderId },
    data: { status: "PROCESSING" },
  });

  try {
    const result = await runAutoEdit({
      id: order.id,
      formatName: order.formatName,
      telopId: order.telopId,
      structure: order.structure as any[],
      mediaPaths: (mediaPaths || order.mediaPaths) as string[] | null,
      bgmPath: (bgmPath || order.bgmPath) as string | null,
    });

    // Update status to COMPLETED
    await prisma.snsFormatOrder.update({
      where: { id: orderId },
      data: {
        status: "COMPLETED",
        mediaPaths: mediaPaths || order.mediaPaths,
      },
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    // Update status to FAILED
    await prisma.snsFormatOrder.update({
      where: { id: orderId },
      data: {
        status: "FAILED",
        errorMessage: error.message || "Unknown error",
      },
    });

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
