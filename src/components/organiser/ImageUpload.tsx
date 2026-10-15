"use client";
/* eslint-disable @next/next/no-img-element */

import { useId, useRef, useState } from "react";
import { uploadImage, type ImageBucket } from "@/lib/storage";

/**
 * Click-to-upload image with preview. Uploads straight to Supabase Storage and reports the
 * public URL through `onChange`; pass `name` to also submit it with a normal <form>.
 */
export function ImageUpload({ bucket, value, onChange, name, shape = "cover", label, hint }: {
  bucket: ImageBucket;
  value: string;
  onChange: (url: string) => void;
  name?: string;
  shape?: "cover" | "logo";
  label: string;
  hint?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadImage(bucket, file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed — try another image");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const logo = shape === "logo";
  const frame = logo ? "h-24 w-24 rounded-2xl" : "aspect-[16/9] w-full rounded-2xl";

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-fg">{label}</label>
      <div className={logo ? "flex items-center gap-4" : "space-y-2"}>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={value ? `Change ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
          className={`group relative overflow-hidden border border-dashed border-line bg-surface transition-colors hover:border-violet/60 disabled:cursor-wait ${frame}`}
        >
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted">
              <span className="bg-gradient absolute inset-0 opacity-[0.07]" aria-hidden />
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <path d="M4 16l4.5-4.5a2 2 0 0 1 2.8 0L16 16m-2-2 1.5-1.5a2 2 0 0 1 2.8 0L20 14M14 8h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {!logo && <span className="text-xs">Tap to add an image</span>}
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-bg/70 text-xs font-medium text-fg backdrop-blur-sm">
              Uploading…
            </span>
          )}
        </button>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="font-medium text-pink hover:text-fg">
            {value ? "Replace" : "Upload"}
          </button>
          {value && (
            <button type="button" onClick={() => onChange("")} disabled={busy} className="text-muted hover:text-fg">
              Remove
            </button>
          )}
          {hint && <span className="text-muted">{hint}</span>}
        </div>
      </div>
      <input
        ref={input}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {name && <input type="hidden" name={name} value={value} />}
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
