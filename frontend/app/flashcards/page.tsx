"use client";

import { useState, useEffect } from "react";

type CardError = {
  errorTag: string;
  category: string;
  excerpt: string | null;
  correction: string;
  explanation: string;
  gloss: string;
};

type Card = {
  id: string;
  interval: number;
  reviewCount: number;
  errorEvent: CardError;
};

type Rating = "again" | "hard" | "good" | "easy";

const CATEGORY_COLOR: Record<string, string> = {
  grammaire:     "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  lexique:       "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  orthographe:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
  syntaxe:       "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  registre:      "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  comprehension: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400",
};

const RATING_BUTTONS: { rating: Rating; label: string; sub: string; color: string }[] = [
  { rating: "again", label: "Encore",   sub: "< 1j",  color: "border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30" },
  { rating: "hard",  label: "Difficile",sub: "~1–3j", color: "border-orange-300 text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30" },
  { rating: "good",  label: "Bien",     sub: "~3–6j", color: "border-green-300 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30" },
  { rating: "easy",  label: "Facile",   sub: "~7j+",  color: "border-teal-300 text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/30" },
];

export default function FlashcardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [total, setTotal] = useState(0);
  const [nextDue, setNextDue] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/flashcards")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setCards(data.due);
        setTotal(data.total);
        setNextDue(data.nextDue);
        if (data.due.length === 0) setDone(true);
      })
      .catch(() => setError("Impossible de charger les cartes."))
      .finally(() => setLoading(false));
  }, []);

  async function handleRating(rating: Rating) {
    const card = cards[index];
    if (!card || submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, rating }),
      });
    } catch { /* non-fatal — schedule update failure doesn't block UX */ }

    const next = index + 1;
    if (next >= cards.length) {
      setDone(true);
    } else {
      setIndex(next);
      setFlipped(false);
    }
    setSubmitting(false);
  }

  const current = cards[index];
  const remaining = cards.length - index;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-sm text-zinc-400 animate-pulse">Chargement des cartes…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-xl mx-auto px-4 py-12 space-y-6">

        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Révision</p>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Flashcards</h1>
          </div>
          <span className="text-xs text-zinc-400">{total} carte{total !== 1 ? "s" : ""} au total</span>
        </header>

        {done ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-6 py-10 text-center space-y-3">
            <p className="text-2xl">✓</p>
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Session terminée !</p>
            {nextDue ? (
              <p className="text-xs text-zinc-400">
                Prochaine carte :{" "}
                {new Date(nextDue).toLocaleDateString("fr-CA", {
                  day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
                })}
              </p>
            ) : (
              <p className="text-xs text-zinc-400">Toutes les cartes sont à jour.</p>
            )}
            <div className="flex justify-center gap-3 pt-2">
              <a href="/dashboard" className="rounded-full border border-zinc-200 dark:border-zinc-700 px-5 py-2 text-sm text-zinc-700 dark:text-zinc-300">
                Mon profil
              </a>
              <a href="/" className="rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2 text-sm font-medium">
                Accueil
              </a>
            </div>
          </div>
        ) : current ? (
          <>
            {/* Progress */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100 transition-all"
                  style={{ width: `${(index / cards.length) * 100}%` }}
                />
              </div>
              <span className="text-xs text-zinc-400 shrink-0">
                {remaining} restante{remaining !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Card — click front to flip */}
            <div
              className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-6 py-8 min-h-[220px] flex flex-col justify-between cursor-pointer select-none"
              onClick={() => !flipped && setFlipped(true)}
            >
              {!flipped ? (
                <div className="space-y-4 flex-1 flex flex-col justify-center">
                  <span className={`self-start inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLOR[current.errorEvent.category] ?? "bg-zinc-100 text-zinc-600"}`}>
                    {current.errorEvent.category}
                  </span>
                  {current.errorEvent.excerpt ? (
                    <p className="text-base text-zinc-800 dark:text-zinc-200 leading-relaxed">
                      « {current.errorEvent.excerpt} »
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {current.errorEvent.errorTag}
                      </p>
                      <p className="text-sm text-zinc-500">{current.errorEvent.gloss}</p>
                    </div>
                  )}
                  <p className="text-xs text-zinc-400 mt-auto pt-4">
                    Appuie pour révéler la correction →
                  </p>
                </div>
              ) : (
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLOR[current.errorEvent.category] ?? "bg-zinc-100 text-zinc-600"}`}>
                      {current.errorEvent.category}
                    </span>
                    <span className="text-xs font-mono text-zinc-500">{current.errorEvent.errorTag}</span>
                  </div>
                  {current.errorEvent.excerpt && (
                    <p className="text-sm text-zinc-500 italic">« {current.errorEvent.excerpt} »</p>
                  )}
                  <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 px-4 py-3">
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-0.5">Correction</p>
                    <p className="text-sm text-green-800 dark:text-green-300">{current.errorEvent.correction}</p>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{current.errorEvent.explanation}</p>
                </div>
              )}
            </div>

            {/* Rating buttons — appear after flip */}
            {flipped && (
              <div className="grid grid-cols-4 gap-2">
                {RATING_BUTTONS.map(({ rating, label, sub, color }) => (
                  <button
                    key={rating}
                    onClick={() => handleRating(rating)}
                    disabled={submitting}
                    className={`rounded-lg border px-3 py-3 text-center transition-colors disabled:opacity-40 ${color}`}
                  >
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs opacity-70 mt-0.5">{sub}</div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : null}

      </div>
    </div>
  );
}
