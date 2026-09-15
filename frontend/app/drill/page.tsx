import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { getTaxonomyEntry } from "@/lib/taxonomy";

const CATEGORY_COLORS: Record<string, string> = {
  grammaire: "bg-red-500",
  lexique: "bg-blue-500",
  orthographe: "bg-yellow-500",
  syntaxe: "bg-purple-500",
  registre: "bg-orange-500",
};

const SIGNAL_STYLE: Record<string, string> = {
  improving: "bg-green-100 text-green-800 border-green-200",
  mixed: "bg-yellow-100 text-yellow-800 border-yellow-200",
  still_struggling: "bg-red-100 text-red-800 border-red-200",
};
const SIGNAL_LABEL: Record<string, string> = {
  improving: "En progrès",
  mixed: "Résultats mixtes",
  still_struggling: "Encore des difficultés",
};

export default async function DrillHistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const userId = user.id;

  const drills = await db.drill.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  }).catch(() => null);

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs text-ink-faint uppercase tracking-widest mb-1">Reverse Tutor</p>
            <h1 className="text-xl font-semibold text-ink">Historique des drills</h1>
          </div>
          <Link href="/practice" className="text-sm text-ink-muted hover:text-zinc-700 dark:hover:text-zinc-300">
            Nouveau drill →
          </Link>
        </header>

        {drills === null ? (
          <div className="border-2 border-rule bg-paper-raised px-6 py-8 text-sm text-ink-muted">
            L&apos;historique sera disponible lorsque la base de données sera connectée.
          </div>
        ) : drills.length === 0 ? (
          <div className="rounded-none border border-rule bg-paper-raised px-6 py-8 text-center text-sm text-ink-faint">
            Aucun drill pour l&apos;instant — <Link href="/practice" className="underline">essaie Pratiquer</Link>.
          </div>
        ) : (
          <div className="space-y-3">
            {drills.map((drill) => {
              const payload = (drill.payload as any) ?? {};
              const tag = payload.target_error_tag as string | undefined;
              const category = tag ? getTaxonomyEntry(tag)?.category : undefined;
              const color = category ? (CATEGORY_COLORS[category] ?? "bg-zinc-400") : "bg-zinc-400";
              const signal = payload.last_mastery_signal as string | undefined;
              const submitted = drill.responseSubmissionId != null;

              return (
                <div
                  key={drill.id}
                  className="rounded-none border border-rule bg-paper-raised px-4 py-3 flex items-center gap-3"
                >
                  <span className={`w-2 h-2 rounded-none shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono text-ink">{tag ?? "—"}</span>
                      {drill.resolved && (
                        <span className="text-xs text-green-700 dark:text-green-400">✓ maîtrisé</span>
                      )}
                    </div>
                    <p className="text-xs text-ink-faint mt-0.5">
                      {payload.topic ?? ""} · {drill.createdAt.toLocaleDateString("fr-CA")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {signal ? (
                      <span className={`rounded-none border px-2 py-0.5 text-xs font-medium ${SIGNAL_STYLE[signal] ?? ""}`}>
                        {SIGNAL_LABEL[signal] ?? signal}
                      </span>
                    ) : (
                      <span className="rounded-none border border-rule px-2 py-0.5 text-xs text-ink-faint">
                        {submitted ? "Corrigé" : "Non soumis"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
