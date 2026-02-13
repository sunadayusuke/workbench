import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workbench",
  description: "個人用アプリポータル",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="light">
      <body>{children}</body>
    </html>
  );
}
