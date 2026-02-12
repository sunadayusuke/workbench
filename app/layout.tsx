import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "Workbench",
  description: "Personal app portal",
};

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Apps", href: "/apps" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <div className={styles.wrapper}>
          <aside className={styles.sidebar}>
            <div className={styles.logo}>Workbench</div>
            <nav className={styles.nav}>
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className={styles.navItem}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className={styles.main}>{children}</main>
        </div>
      </body>
    </html>
  );
}
