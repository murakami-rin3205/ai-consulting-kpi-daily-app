import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIコンサル事業部 KPI・日報",
  description: "KPI管理と日報を一体化した事業部ダッシュボード",
  manifest: "/manifest.json",
  applicationName: "AI KPI日報",
  appleWebApp: {
    capable: true,
    title: "AI KPI日報",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
