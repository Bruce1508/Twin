import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
      <div className="max-w-sm w-full px-6 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Linguistic Twin</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Un système qui apprend tes erreurs en français et génère des exercices ciblés.
          </p>
          <p className="mt-1 text-xs text-zinc-400 italic">
            Estimation de progression uniquement — non officielle. Pour la certification TCF, consulte les sources officielles d'IRCC.
          </p>
        </div>
        <nav className="space-y-3">
          {[
            { href: "/submit", title: "Écrire", sub: "Soumettre un texte en français" },
            { href: "/read", title: "Lire", sub: "Compréhension écrite — questions style TCF" },
            { href: "/speak", title: "Parler", sub: "Expression orale — monologue style TCF" },
            { href: "/practice", title: "Pratiquer", sub: "Exercice Reverse Tutor sur ton point faible" },
            { href: "/dashboard", title: "Profil", sub: "Voir tes erreurs accumulées" },
          ].map(({ href, title, sub }) => (
            <Link key={href} href={href} className="flex items-center justify-between w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{sub}</div>
              </div>
              <span className="text-zinc-300">→</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
