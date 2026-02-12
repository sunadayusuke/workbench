import Link from "next/link";
import styles from "./page.module.css";

const apps = [
  {
    name: "Memo",
    description: "Quick notes & scratch pad",
    href: "/apps/memo",
    icon: "📝",
  },
  {
    name: "Timer",
    description: "Pomodoro & stopwatch",
    href: "/apps/timer",
    icon: "⏱",
  },
  {
    name: "JSON Formatter",
    description: "Paste & format JSON",
    href: "/apps/json-formatter",
    icon: "{ }",
  },
];

export default function Home() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Workbench</h1>
      <p className={styles.subtitle}>Your personal toolkit</p>
      <div className={styles.grid}>
        {apps.map((app) => (
          <Link key={app.href} href={app.href} className={styles.card}>
            <div className={styles.cardIcon}>{app.icon}</div>
            <div className={styles.cardTitle}>{app.name}</div>
            <div className={styles.cardDesc}>{app.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
