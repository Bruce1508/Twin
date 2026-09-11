import { getProfile, topSpanTags } from "@/lib/profile";
import { db } from "@/lib/db";
import { getTaxonomyEntry, READING_TAGS, SPEAKING_TAGS, LISTENING_TAGS } from "@/lib/taxonomy";
import Link from "next/link";

const CATEGORY_COLORS: Record<string, string> = {
  grammaire: "bg-red-500",
  lexique: "bg-blue-500",
  orthographe: "bg-yellow-500",
  syntaxe: "bg-purple-500",
  registre: "bg-orange-500",
};

export default async function DashboardPage() {
  const userId = process.env.DEV_USER_ID ?? "";

  let profile = null;
  let submissionCount = 0;
  let totalWords = 0;
  let uncategorizedCount = 0;
  let totalErrors = 0;
  let dbError = false;

  try {
    profile = userId ? await getProfile(userId) : null;
    if (userId) {
      const subs = await db.submission.findMany({
        where: { userId },
        select: { wordCount: true },
      });
      submissionCount = subs.length;
      totalWords = subs.reduce((s: number, r: any) => s + r.wordCount, 0);
      if (profile) {
        totalErrors = Object.values(profile.errorFrequencies).reduce(
          (s, n) => s + n, 0
        );
        uncategorizedCount = profile.errorFrequencies["uncategorized"] ?? 0;
      }
    }
  } catch {
    dbError = true;
  }

  const allTop = profile ? topSpanTags(profile.errorFrequencies, 20) : [];
  const writingTop   = allTop.filter(({ tag }) => !READING_TAGS.includes(tag as never) && !SPEAKING_TAGS.includes(tag as never) && !LISTENING_TAGS.includes(tag as never)).slice(0, 10);
  const readingTop   = allTop.filter(({ tag }) => READING_TAGS.includes(tag as never)).slice(0, 6);
  const speakingTop  = allTop.filter(({ tag }) => SPEAKING_TAGS.includes(tag as never)).slice(0, 6);
  const listeningTop = allTop.filter(({ tag }) => LISTENING_TAGS.includes(tag as never)).slice(0, 6);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Profil</h1>
            <p className="mt-1 text-sm text-zinc-500">Tes patterns d'erreurs accumulés au fil du temps.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/report" className="rounded-full border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300">
              Rapport
            </Link>
            <Link href="/submit" className="rounded-full border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300">
              Écrire
            </Link>
            <Link href="/practice" className="rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium">
              Pratiquer
            </Link>
          </div>
        </header>

        {dbError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Base de données non configurée — configure DATABASE_URL et DEV_USER_ID dans .env.
          </div>
        )}

        {!dbError && (
          <>
            <div className="grid grid-cols-4 gap-3">
              {([["Soumissions", submissionCount], ["Mots produits", totalWords], ["Erreurs détectées", totalErrors], ["Non catégorisées", uncategorizedCount]] as [string, number][]).map(
                ([label, value]) => (
                  <div key={label} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3">
                    <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
                  </div>
                )
              )}
            </div>

            {writingTop.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">Erreurs à l'écrit</h2>
                <div className="space-y-2">
                  {writingTop.map(({ tag, count }) => {
                    const entry = getTaxonomyEntry(tag);
                    const color = CATEGORY_COLORS[entry?.category ?? ""] ?? "bg-zinc-400";
                    const pct = Math.round((count / (writingTop[0]?.count ?? 1)) * 100);
                    return (
                      <div key={tag} className="flex items-center gap-3">
                        <div className="w-48 text-xs text-zinc-700 dark:text-zinc-300 truncate shrink-0">{tag}</div>
                        <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="w-6 text-xs text-right text-zinc-500 shrink-0">{count}</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {readingTop.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">Erreurs de compréhension</h2>
                <div className="space-y-2">
                  {readingTop.map(({ tag, count }) => {
                    const pct = Math.round((count / (readingTop[0]?.count ?? 1)) * 100);
                    return (
                      <div key={tag} className="flex items-center gap-3">
                        <div className="w-48 text-xs text-zinc-700 dark:text-zinc-300 truncate shrink-0">{tag}</div>
                        <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="w-6 text-xs text-right text-zinc-500 shrink-0">{count}</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {speakingTop.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">Erreurs à l&apos;oral</h2>
                <div className="space-y-2">
                  {speakingTop.map(({ tag, count }) => {
                    const pct = Math.round((count / (speakingTop[0]?.count ?? 1)) * 100);
                    return (
                      <div key={tag} className="flex items-center gap-3">
                        <div className="w-48 text-xs text-zinc-700 dark:text-zinc-300 truncate shrink-0">{tag}</div>
                        <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                          <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="w-6 text-xs text-right text-zinc-500 shrink-0">{count}</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {listeningTop.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">Erreurs à l&apos;écoute</h2>
                <div className="space-y-2">
                  {listeningTop.map(({ tag, count }) => {
                    const pct = Math.round((count / (listeningTop[0]?.count ?? 1)) * 100);
                    return (
                      <div key={tag} className="flex items-center gap-3">
                        <div className="w-48 text-xs text-zinc-700 dark:text-zinc-300 truncate shrink-0">{tag}</div>
                        <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                          <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="w-6 text-xs text-right text-zinc-500 shrink-0">{count}</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {writingTop.length === 0 && readingTop.length === 0 && speakingTop.length === 0 && listeningTop.length === 0 && (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-6 py-8 text-center text-sm text-zinc-400">
                Aucune donnée —{" "}
                <Link href="/submit" className="underline">soumettre un texte</Link>,{" "}
                <Link href="/read" className="underline">faire un exercice de lecture</Link>{" "}ou{" "}
                <Link href="/speak" className="underline">pratiquer l&apos;oral</Link>.
              </div>
            )}

            {profile && profile.complexityTrend.length > 1 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">Complexité au fil du temps</h2>
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-4">
                  <div className="flex items-end gap-1 h-20">
                    {profile.complexityTrend.map((pt, i) => {
                      const maxLen = Math.max(...profile.complexityTrend.map((p) => p.avgSentenceLength));
                      const h = Math.max(4, Math.round((pt.avgSentenceLength / maxLen) * 80));
                      return (
                        <div
                          key={i}
                          title={`#${i + 1} · ${pt.avgSentenceLength.toFixed(1)} mots/phrase`}
                          className="flex-1 bg-zinc-900 dark:bg-zinc-100 rounded-sm opacity-70 hover:opacity-100"
                          style={{ height: `${h}px` }}
                        />
                      );
                    })}
                  </div>
                  <p className="text-xs text-zinc-400 mt-2">Longueur moyenne des phrases · {profile.complexityTrend.length} soumissions</p>
                </div>
              </section>
            )}

            {totalErrors > 0 && uncategorizedCount / totalErrors > 0.1 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <strong>Taxonomie :</strong> {Math.round((uncategorizedCount / totalErrors) * 100)}% des erreurs sont non catégorisées — la taxonomie mérite d'être enrichie.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
