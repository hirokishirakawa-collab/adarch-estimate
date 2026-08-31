import { SignageHeader, SignageNav } from "@/components/signage/shared";
import { PlaylistList } from "@/components/signage/playlist-list";

export const dynamic = "force-dynamic";

export default function SignagePlaylistsPage() {
  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <SignageHeader title="サイネージ プレイリスト（枠）" desc="1周のループを枠で組み、枠ごとに広告主と掲載期間を持ちます＝空き枠の在庫がここで見えます" />
      <SignageNav active="playlists" />
      <PlaylistList />
    </div>
  );
}
