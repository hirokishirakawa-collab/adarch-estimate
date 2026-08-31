import Link from "next/link";
import { SignageHeader, SignageNav } from "@/components/signage/shared";
import { PlaylistEditor } from "@/components/signage/playlist-editor";

export const dynamic = "force-dynamic";

export default async function SignagePlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <SignageHeader title="プレイリストを編集" desc="保存すると、このプレイリストを使う端末に次回の問い合わせ（既定60秒）で反映されます" right={<Link href="/dashboard/signage/playlists" className="text-xs text-zinc-500 hover:text-zinc-800">← 一覧へ</Link>} />
      <SignageNav active="playlists" />
      <PlaylistEditor playlistId={id} />
    </div>
  );
}
