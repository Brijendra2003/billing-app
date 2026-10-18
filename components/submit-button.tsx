"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui";

/** Submit button for server-rendered forms: shows a spinner and disables itself while the form is submitting. */
export function SubmitButton({
  children,
  className = "btn-primary",
  icon,
  title,
  ariaLabel,
}: {
  children?: ReactNode;
  className?: string;
  icon?: ReactNode;
  title?: string;
  ariaLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} title={title} aria-label={ariaLabel}>
      {pending ? <Spinner /> : icon}
      {children}
    </button>
  );
}
