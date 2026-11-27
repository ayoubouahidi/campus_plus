"use client";

import { useEffect, useId, useState } from "react";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Client-side check matching Django's validators (type, strictly under 2 MB). */
export function imageFileError(file: FormDataEntryValue | null): string | null {
  if (!(file instanceof File) || file.size === 0) return null;
  if (!IMAGE_TYPES.includes(file.type)) return "Choose a JPEG, PNG or WebP image.";
  if (file.size >= MAX_IMAGE_BYTES) return "The image must be smaller than 2 MB.";
  return null;
}

/**
 * Image upload field: shows the current image (or a preview of the chosen file),
 * a file input, and optionally "Remove" (submits `remove_<name>=true`).
 * Errors use the same rose border + message as Input.
 */
export default function ImagePicker({
  name,
  label,
  currentUrl,
  error,
  helperText = "JPEG, PNG or WebP under 2 MB.",
  aspect = "square",
  removable = false,
  onChange,
}: {
  name: string;
  label: string;
  currentUrl?: string | null;
  error?: string;
  helperText?: string;
  aspect?: "square" | "banner" | "flyer";
  removable?: boolean;
  onChange?: () => void;
}) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const shown = remove ? null : preview ?? currentUrl ?? null;
  const frame =
    aspect === "banner" ? "aspect-[3/1] w-full" : aspect === "flyer" ? "aspect-[4/3] w-40" : "h-20 w-20";

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="flex flex-wrap items-start gap-4">
        <div
          className={`${frame} shrink-0 overflow-hidden rounded-lg border bg-slate-50 dark:bg-slate-800 ${
            error ? "border-rose-500" : "border-slate-200 dark:border-slate-700"
          }`}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob previews and media URLs; next/image can't load blob: URLs.
            <img src={shown} alt={`${label} preview`} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-slate-400">No image</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            id={id}
            name={name}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-help`}
            onChange={(event) => {
              const file = event.target.files?.[0];
              setRemove(false);
              setPreview((old) => {
                if (old) URL.revokeObjectURL(old);
                return file && IMAGE_TYPES.includes(file.type) ? URL.createObjectURL(file) : null;
              });
              onChange?.();
            }}
            className={`block w-full rounded-lg border bg-white text-sm text-slate-700 file:mr-3 file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-violet-700 dark:bg-slate-900 dark:text-slate-300 dark:file:bg-violet-500/15 dark:file:text-violet-300 ${
              error ? "border-rose-500" : "border-slate-300 dark:border-slate-700"
            }`}
          />
          <p
            id={`${id}-help`}
            className={`text-xs ${error ? "font-medium text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}`}
          >
            {error ?? helperText}
          </p>
          {removable && currentUrl && !preview && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                name={`remove_${name}`}
                value="true"
                checked={remove}
                onChange={(event) => setRemove(event.target.checked)}
                className="h-4 w-4 accent-rose-600"
              />
              Remove the current image
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
