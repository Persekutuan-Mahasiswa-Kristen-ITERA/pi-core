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
      <body className="antialiased">{children}</body>
    </html>
  );
}
