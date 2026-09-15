import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { getPlanDay } from "@/lib/plan";
import { buildSession, type SessionStep } from "@/lib/session";
import { getTaxonomyEntry } from "@/lib/taxonomy";
import HomeworkBanner from "./HomeworkBanner";

export const dynamic = "force-dynamic";

const modules = [
  ["/submit", "Écrire"], ["/read", "Lire"], ["/listen", "Écouter"], ["/speak", "Parler"],
  ["/flashcards", "Réviser"], ["/practice", "Pratiquer"], ["/drill", "Historique"], ["/dashboard", "Profil"],
] as const;

async function getHomeState() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const userId = user.id;
  try {
    const [progress, profile] = await Promise.all([
      db.sessionProgress.findUnique({ where: { userId } }),
      db.profile.findUnique({ where: { userId } }),
    ]);
    const planDay = getPlanDay(progress?.planPosition ?? 1);
    const saved = progress?.activeSession as SessionStep[] | null;
    const steps = saved?.length ? saved : buildSession({ planDay, weakTag: null, hasDueCards: false, hasDueTags: false, mode: "full" });
    const frequencies = (profile?.errorFrequencies as Record<string, number> | undefined) ?? {};
    const signals = Object.entries(frequencies).sort((a, b) => b[1] - a[1]).slice(0, 4);
    return { planDay, steps, signals };
  } catch {
    const planDay = getPlanDay(1);
    const steps = buildSession({ planDay, weakTag: null, hasDueCards: false, hasDueTags: false, mode: "full" });
    return { planDay, steps, signals: [] as [string, number][] };
  }
}

export default async function Home() {
  const { planDay, steps, signals } = await getHomeState();
  const current = steps.find((step) => step.status === "pending") ?? steps[0];
  const currentIndex = Math.max(0, steps.indexOf(current));
  const date = new Intl.DateTimeFormat("fr-CA", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());

  return (
    <div className="home-workspace">
      <header className="home-masthead">
        <div>
          <p className="home-eyebrow">Carnet d&apos;apprentissage · Jour {planDay.day}</p>
          <h1 className="home-title">{planDay.theme}</h1>
        </div>
        <div className="home-date">{date}<br />NIVEAU VISÉ — B2</div>
      </header>

      <section className="session-board" aria-labelledby="session-title">
        <div className="session-action">
          <div className="session-counter"><span>SÉANCE DU JOUR</span><span>{currentIndex + 1}/{steps.length}</span></div>
          <h2 id="session-title">{current?.label ?? "Commencer"}</h2>
          <p>{current?.topic ?? planDay.theme}. La prochaine étape est prête; ta progression reprend exactement ici.</p>
          <Link className="session-route" href={`${current?.route ?? "/today"}?session=1`}>Continuer la séance →</Link>
        </div>
        <ol className="session-cells">
          {steps.map((step, index) => (
            <li key={`${step.kind}-${index}`} className={`session-cell ${step === current ? "is-current" : ""} ${step.status === "done" ? "is-done" : ""}`}>
              <span>{String(index + 1).padStart(2, "0")} / {step.status === "done" ? "TERMINÉ" : step === current ? "EN COURS" : "À VENIR"}</span>
              <strong>{step.label}</strong>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-ledger">
        <div className="ledger-panel">
          <div className="ledger-heading"><h2>Signaux du twin</h2><span className="ledger-label">PROFIL DÉRIVÉ</span></div>
          {signals.length ? signals.map(([tag, count], index) => (
            <div className="signal-row" key={tag}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <span>{getTaxonomyEntry(tag)?.gloss ?? tag}</span>
              <small>{count}×</small>
            </div>
          )) : <p>Ton profil se construit à partir de tes productions. Écris un premier texte pour révéler les tendances réelles.</p>}
        </div>
        <div className="ledger-panel">
          <div className="ledger-heading"><h2>Note du tuteur</h2><span className="ledger-label">À FAIRE</span></div>
          <HomeworkBanner />
          <p>Travaille une étape à la fois. Les corrections utiles reviennent ensuite dans tes flashcards et exercices ciblés.</p>
          <Link href="/today" className="session-route">Voir le plan complet →</Link>
        </div>
      </section>

      <section className="module-index" aria-labelledby="module-title">
        <h2 id="module-title">Travail libre</h2>
        <div className="module-list">
          {modules.map(([href, label], index) => <Link href={href} key={href}><small>{String(index + 1).padStart(2, "0")}</small><strong>{label}</strong></Link>)}
        </div>
      </section>
      <footer className="home-footer"><span>Linguistic Twin · espace personnel</span><span>Estimation pédagogique non officielle</span></footer>
    </div>
  );
}
