"use client";

import { useId } from "react";

// On/off setting rendered as a checkbox (so it submits with the form and works
// with the keyboard), with a label and a one-line explanation.
export default function Switch({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
}) {
  const id = useId();
  const descriptionId = `${id}-description`;
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        aria-describedby={description ? descriptionId : undefined}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-violet-600"
      />
      <div>
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
