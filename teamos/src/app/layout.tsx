import type { Metadata, Viewport } from "next";
import "./globals.css";
import SwRegister from "@/components/SwRegister";

export const metadata: Metadata = {
  title: "TeamOS — NoraPadel & Gridline",
  description: "Internal HR-lite: absensi, cuti, KPI, dan tim",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "TeamOS" },
};

export const viewport: Viewport = {
  themeColor: "#00c20d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
