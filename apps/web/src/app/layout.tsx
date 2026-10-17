import type { Metadata } from "next";
import type { JSX, ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PI-CORE — Admin Portal",
  description: "PMK ITERA Centralized Organization & Role Engine",
  icons: { icon: "/favicon.jpg", shortcut: "/favicon.jpg" },
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
