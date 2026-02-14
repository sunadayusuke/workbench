import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workbench",
  description: "sunaのデザイン作業台",
  icons: {
    icon: "/images/favicon.svg",
  },
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
