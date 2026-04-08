"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCreatorProfileImage } from "./actions";

interface Props {
  creatorId: string;
  currentImage: string | null;
  name: string;
}

export function ProfileImageUpload({ creatorId, currentImage, name }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(currentImage);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload
    const formData = new FormData();
    formData.set("creatorId", creatorId);
    formData.set("profileImage", file);

    startTransition(async () => {
      const result = await updateCreatorProfileImage(formData);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.error || "アップロードに失敗しました");
      }
    });
  };

  return (
    <div className="relative group">
      <div
        className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer border-2 border-transparent hover:border-indigo-400 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-zinc-400 text-xl font-bold">{name.charAt(0)}</span>
        )}
        {isPending && (
          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center shadow-sm cursor-pointer hover:bg-indigo-600 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
