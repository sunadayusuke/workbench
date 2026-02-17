import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workbench",
  description: "sunaのデザイン作業台",
  icons: {
    icon: "/images/favicon.svg",
  },
  openGraph: {
    title: "Workbench",
    description: "sunaのデザイン作業台",
    url: "https://workbench.suna.design",
    siteName: "Workbench",
    images: [{ url: "/images/ogp.png" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Workbench",
    description: "sunaのデザイン作業台",
    images: ["/images/ogp.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="light">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
