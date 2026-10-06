"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  Database,
  Leaf,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { useBusiness } from "@/components/business-provider";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: ChartNoAxesCombined },
  { href: "/data", label: "Data", icon: Database },
  { href: "/ask", label: "Tanya RAMU", icon: MessageCircle },
];
export function RamuMark({ small = false }: { small?: boolean }) {
  return (
    <span
      className={cn("ramu-mark", small && "ramu-mark-small")}
      aria-hidden="true"
    >
      <Leaf strokeWidth={1.7} />
    </span>
  );
}
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname(),
    { data } = useBusiness();
  return (
    <div className="app-shell">
      <a href="#konten" className="skip-link">
        Lewati ke konten
      </a>
      <aside className="sidebar">
        <Link
          href="/dashboard"
          className="brand"
          aria-label="RAMU — halaman utama"
        >
          <RamuMark />
          <span>
            ramu<span className="brand-dot">.</span>
          </span>
        </Link>
        <p className="brand-tagline">
          Ramu data.
          <br />
          Temukan peluang.
        </p>
        <p className="nav-caption">RUANG BISNIS</p>
        <nav aria-label="Navigasi utama">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={cn("nav-link", pathname === href && "active")}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{label}</span>
              {pathname === href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Sparkles size={19} />
            <h3>Angka jadi arah.</h3>
            <p>Kenali bisnis Anda lebih dekat, satu insight setiap hari.</p>
            <Link href="/ask">
              Mulai percakapan <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="privacy-note">
            <ShieldCheck size={15} />
            <span>Data hanya di sesi ini</span>
          </div>
          <div className="sidebar-footer">
            <span>RAMU LITE</span>
            <span>VERSI 0.1</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Ruang bisnis</span>
            <span className="breadcrumb-slash">/</span>
            <strong>
              {links.find((l) => l.href === pathname)?.label ?? "Dashboard"}
            </strong>
          </div>
          <div className="workspace-status">
            <span className={cn("status-dot", data && "loaded")} />
            {data
              ? data.source.kind === "demo"
                ? "Ramu Bakery · Data demo"
                : "Data bisnis aktif"
              : "Ruang bisnis Anda"}
            <span className="avatar">
              {data?.source.kind === "demo" ? "RB" : "R"}
            </span>
          </div>
        </header>
        <main id="konten" tabIndex={-1}>
          {children}
        </main>
        <footer className="main-footer">
          <span>Dibuat untuk bisnis yang terus bertumbuh.</span>
          <span>
            <Leaf size={12} /> Ramu data. Temukan peluang.
          </span>
        </footer>
      </div>
    </div>
  );
}
