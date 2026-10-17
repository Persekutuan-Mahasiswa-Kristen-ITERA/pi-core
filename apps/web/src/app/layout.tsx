import type { Metadata } from "next";
import type { JSX, ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PI-CORE — Admin Portal",
  description: "PMK ITERA Centralized Organization & Role Engine",
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
