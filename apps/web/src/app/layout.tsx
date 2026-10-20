import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import type { JSX, ReactNode } from "react";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "PI-CORE — PMK ITERA Centralized Organization & Role Engine",
  description: "Layanan identitas, peran, keanggotaan, dan SSO terpusat PMK ITERA.",
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="id" className={`${plusJakarta.variable} ${inter.variable}`}>
      <body className="antialiased">
        {/*
          Every admin screen except Integrations still renders sample rows and never calls the API.
          That is not cosmetic: the web and API Workers are separate `*.workers.dev` sites, and the
          Better Auth session cookie is `SameSite=Lax`, so a cross-site XHR from this page cannot
          carry it — `/api/v1/*` answers 401. Until the origin topology is settled (custom domain vs.
          same-origin proxy; ADR pending) nobody should read these rows as real PMK data.
        */}
        <div
          role="status"
          className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-900"
        >
          Pratinjau UI — baris data pada halaman ini masih contoh dan belum tersambung ke API PI-CORE.
        </div>
        {children}
      </body>
    </html>
  );
}
