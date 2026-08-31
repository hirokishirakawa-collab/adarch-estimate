import { SignageHeader, SignageNav } from "@/components/signage/shared";
import { AssetLibrary } from "@/components/signage/asset-library";

export const dynamic = "force-dynamic";

export default function SignageAssetsPage() {
  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <SignageHeader title="サイネージ 素材" desc="端末で流す画像・動画。プレイリストの枠に入れて放映します" />
      <SignageNav active="assets" />
      <AssetLibrary />
    </div>
  );
}
