import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BusinessProvider } from "@/components/business-provider";
import { AppShell } from "@/components/layout/app-shell";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAMU — AI Business Copilot",
  description:
    "Ramu data. Temukan peluang. Pahami pendapatan, produk, dan peluang bisnis UMKM Anda.",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" data-scroll-behavior="smooth">
      <body>
        <BusinessProvider>
          <AppShell>{children}</AppShell>
        </BusinessProvider>
      </body>
    </html>
  );
}
