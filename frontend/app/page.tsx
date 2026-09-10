import Link from "next/link";
import ReviserBadge from "./ReviserBadge";
import HomeworkBanner from "./HomeworkBanner";

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
        <HomeworkBanner />
        <Link
          href="/today"
          className="block rounded-xl border-2 border-zinc-900 dark:border-zinc-100 bg-white dark:bg-zinc-900 px-5 py-5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <div className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Aujourd&apos;hui</div>
          <div className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">Commencer la séance du jour →</div>
          <div className="mt-0.5 text-xs text-zinc-400">Tout est déjà prêt. Tu n&apos;as rien à choisir.</div>
        </Link>
        <details className="group">
          <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-600 list-none">
            Luyện tự do (choisir un module) ▾
          </summary>
          <nav className="mt-3 space-y-3">
          {[
            { href: "/submit", title: "Écrire", sub: "Soumettre un texte en français" },
            { href: "/read", title: "Lire", sub: "Compréhension écrite — questions style TCF" },
            { href: "/speak", title: "Parler", sub: "Expression orale — monologue style TCF" },
            { href: "/listen", title: "Écouter", sub: "Compréhension orale — QCM style TCF" },
            { href: "/flashcards", title: "Réviser", sub: "Flashcards SRS sur tes erreurs passées" },
            { href: "/practice", title: "Pratiquer", sub: "Exercice Reverse Tutor sur ton point faible" },
            { href: "/drill", title: "Historique", sub: "Revoir tes anciens drills" },
            { href: "/dashboard", title: "Profil", sub: "Voir tes erreurs accumulées" },
          ].map(({ href, title, sub }) => (
            <Link key={href} href={href} className="flex items-center justify-between w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              <div>
                <div className="flex items-center text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {title}
                  {href === "/flashcards" && <ReviserBadge />}
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">{sub}</div>
              </div>
              <span className="text-zinc-300">→</span>
            </Link>
          ))}
        </nav>
        </details>
        <div className="text-center">
          <Link href="/tutor" className="text-xs text-zinc-300 dark:text-zinc-700 hover:text-zinc-400 dark:hover:text-zinc-500 transition-colors">
            Mode tuteur
          </Link>
        </div>
      </div>
    </div>
  );
}
