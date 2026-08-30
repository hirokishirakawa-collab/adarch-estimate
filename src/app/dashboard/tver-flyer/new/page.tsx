import { Tv2 } from "lucide-react";
import { FlyerRequestForm } from "@/components/tver-flyer/flyer-request-form";
import { createTverFlyerRequest } from "@/lib/actions/tver-flyer";

export default function NewTverFlyerPage() {
  return (
    <div className="px-6 py-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
          <Tv2 className="text-blue-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">チラシ制作を本部に依頼する</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            商圏を選ぶと、本部が「◯◯市を、まるごと。」の数値入りA4チラシを作成してお返しします
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <FlyerRequestForm action={createTverFlyerRequest} />
      </div>
    </div>
  );
}
