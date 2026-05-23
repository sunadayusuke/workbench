import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Providers } from "./providers";
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
        <Providers>{children}</Providers>
        <Analytics />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(document.getElementById('bmc-wjs'))return;var s=document.createElement('script');s.id='bmc-wjs';s.src='https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js';s.setAttribute('data-name','BMC-Widget');s.setAttribute('data-cfasync','false');s.setAttribute('data-id','yusukesunada');s.setAttribute('data-description','Support me on Buy me a coffee!');s.setAttribute('data-message','');s.setAttribute('data-color','#000000');s.setAttribute('data-position','left');s.setAttribute('data-x_margin','18');s.setAttribute('data-y_margin','18');s.onload=function(){if(document.readyState!=='loading'){window.dispatchEvent(new Event('DOMContentLoaded'));document.dispatchEvent(new Event('DOMContentLoaded',{bubbles:true}));}};document.body.appendChild(s);})();`,
          }}
        />
      </body>
    </html>
  );
}
