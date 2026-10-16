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
  const frame = logo ? "h-24 w-24 rounded-[20px]" : "aspect-[16/9] w-full rounded-[20px]";

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-fg/90">{label}</label>
      <div className={logo ? "flex items-center gap-4" : "space-y-2"}>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={value ? `Change ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
          className={`group relative overflow-hidden border border-dashed border-white/15 bg-white/[0.03] backdrop-blur-xl transition duration-200 ease-out hover:border-accent/50 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait ${frame}`}
        >
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted">
              <span className="absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgb(169_155_255/0.14),transparent)]" aria-hidden />
              <span className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-fg/80 transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <path d="M4 16l4.5-4.5a2 2 0 0 1 2.8 0L16 16m-2-2 1.5-1.5a2 2 0 0 1 2.8 0L20 14M14 8h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg></span>
              {!logo && <span className="relative text-xs">Tap to add an image</span>}
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-bg/60 text-xs font-medium text-fg backdrop-blur-md">
              Uploading…
            </span>
          )}
        </button>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="font-medium text-accent transition-colors hover:text-fg">
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
