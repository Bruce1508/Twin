"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ReviserBadge from "./ReviserBadge";

const routes = [
  ["/today", "Aujourd'hui", "01"],
  ["/submit", "Écrire", "02"],
  ["/read", "Lire", "03"],
  ["/listen", "Écouter", "04"],
  ["/speak", "Parler", "05"],
  ["/flashcards", "Réviser", "06"],
  ["/practice", "Pratiquer", "07"],
  ["/dashboard", "Profil", "08"],
] as const;

function RouteList({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className={mobile ? "mobile-route-list" : "shell-nav"}>
      {routes.map(([href, label, index]) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}>
            <span className="shell-index">{index}</span>
            <span>{label}</span>
            {href === "/flashcards" && <ReviserBadge />}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <Link href="/" className="shell-wordmark" aria-label="Linguistic Twin — accueil">
          LINGUISTIC<br />TWIN
        </Link>
        <div className="level-stamp"><strong>B2</strong><span>OBJECTIF<br />TCF CANADA</span></div>
        <RouteList />
        <div className="shell-foot">
          <Link href="/drill">Archive des exercices</Link>
          <Link href="/report">Rapport hebdomadaire</Link>
          <Link href="/tutor">Mode tuteur</Link>
        </div>
      </aside>

      <header className="mobile-header">
        <Link href="/" className="mobile-wordmark">LINGUISTIC TWIN</Link>
        <details>
          <summary>MENU</summary>
          <div className="mobile-menu"><RouteList mobile /></div>
        </details>
      </header>

      <main id="main-content" className="app-content">{children}</main>
    </div>
  );
}
