"use client";

import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import type { ReactNode } from "react";

export function Modal({
  title,
  description,
  open,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  open: boolean;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#062218]/45 p-3 backdrop-blur-sm md:items-center">
      <section className="max-h-[92vh] w-full max-w-2xl overflow-auto hdx-panel">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#C1C9BE]/55 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <h2 className="text-lg font-semibold text-[#07160F]">{title}</h2>
            {description ? <p className="mt-1 text-sm text-[#717970]">{description}</p> : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#C1C9BE]/60 bg-white text-[#414941] shadow-sm transition hover:border-[#008943] hover:bg-[#B4F1BD]/25 hover:text-[#006D34] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008943]/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}

export function Drawer({
  title,
  description,
  open,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  open: boolean;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#062218]/45 backdrop-blur-sm">
      <section className="flex h-full w-full max-w-xl flex-col border-l border-[#C1C9BE]/60 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#C1C9BE]/55 bg-white/95 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[#07160F]">{title}</h2>
            {description ? <p className="mt-1 text-sm text-[#717970]">{description}</p> : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#C1C9BE]/60 bg-white text-[#414941] shadow-sm transition hover:border-[#008943] hover:bg-[#B4F1BD]/25 hover:text-[#006D34] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008943]/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5">{children}</div>
      </section>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number" | "email" | "password";
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-[#07160F]">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        required={required}
        className="hdx-control h-10 px-3 text-sm font-normal placeholder:text-[#717970]"
      />
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-[#07160F]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="hdx-control h-10 px-3 text-sm font-normal"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="hdx-subpanel flex items-center gap-3 px-3 py-2 text-sm font-semibold text-[#07160F]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[#008943]"
      />
      {label}
    </label>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="hdx-subpanel border-dashed p-6 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-md bg-[#B4F1BD]/30 text-[#008943]">
        {icon}
      </div>
      <h3 className="mt-3 text-sm font-semibold text-[#07160F]">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[#717970]">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Toast({
  message,
  onClose,
}: {
  message: string | null;
  onClose: () => void;
}) {
  if (!message) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex max-w-sm items-start gap-3 hdx-panel p-4">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#008943]" />
      <p className="min-w-0 flex-1 text-sm font-semibold text-[#07160F]">{message}</p>
      <button
        type="button"
        aria-label="Dismiss"
        title="Dismiss"
        onClick={onClose}
        className="text-[#717970] transition hover:text-[#0E1F12]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#062218]/45 p-3 backdrop-blur-sm">
      <section className="w-full max-w-md hdx-panel p-5">
        <div className="flex gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-amber-50 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#07160F]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#414941]">{description}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-md border border-[#C1C9BE]/60 bg-white px-3 text-sm font-semibold text-[#414941] shadow-sm transition hover:border-[#008943] hover:bg-[#B4F1BD]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008943]/20"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-10 rounded-md bg-[#008943] px-3 text-sm font-semibold text-white shadow-sm shadow-[#008943]/20 transition hover:bg-[#006D34] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008943]/25"
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
