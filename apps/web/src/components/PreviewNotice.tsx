"use client";

/**
 * Marks the screens that still render sample rows.
 *
 * The dashboard, `/anggota` and the sign-in callback talk to the API; the remaining admin pages are
 * layout previews. Saying so in the page itself is the difference between "unfinished" and "showing
 * invented members as if they were the organization's".
 */
import { usePathname } from "next/navigation";
import type { JSX } from "react";

const PREVIEW_ROUTES = [
  "/penugasan",
  "/periode",
  "/peran",
  "/audit-log",
  "/pengaturan",
] as const;

export function PreviewNotice(): JSX.Element | null {
  const pathname = usePathname();
  const isPreview = PREVIEW_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (!isPreview) return null;

  return (
    <div
      role="status"
      className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-900"
    >
      Pratinjau UI — halaman ini masih menampilkan data contoh dan belum tersambung ke API PI-CORE.
    </div>
  );
}
