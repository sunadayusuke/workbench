import Link from "next/link";

const apps = [
  {
    name: "シェーダー",
    description: "WebGLシェーダーデザインツール",
    href: "/apps/shader",
    icon: "🌊",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen px-12 py-10">
      <h1 className="text-[28px] font-bold tracking-tight mb-2">Workbench</h1>
      <p className="text-[15px] text-muted-foreground mb-9">個人用ツールキット</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        {apps.map((app) => (
          <Link
            key={app.href}
            href={app.href}
            className="bg-card border border-border rounded-[var(--radius)] p-6 transition-all select-none hover:border-foreground hover:bg-accent active:scale-[0.98]"
          >
            <div className="text-[28px] mb-3">{app.icon}</div>
            <div className="text-[15px] font-semibold mb-1">{app.name}</div>
            <div className="text-[13px] text-muted-foreground leading-relaxed">{app.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
