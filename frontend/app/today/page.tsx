"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SessionStep } from "@/lib/session";

type TodayResponse = {
  day: number; theme: string; isReview: boolean; steps: SessionStep[]; planPosition: number;
};

export default function TodayPage() {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load(mode?: "min") {
    const qs = mode ? "?mode=min" : "";
    fetch(`/api/today${qs}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError("Impossible de charger la séance."));
  }

  useEffect(() => { load(); }, []);

  if (error) return <Shell><p className="text-sm text-correction-red">{error}</p></Shell>;
  if (!data) return <Shell><p className="text-sm text-ink-faint">Chargement…</p></Shell>;

  const current = data.steps.find((s) => s.status === "pending");
  const doneCount = data.steps.filter((s) => s.status === "done").length;
  const allDone = !current;

  return (
    <Shell>
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-pen-blue">
          Aujourd&apos;hui · Jour {data.day}
        </div>
        <h1 className="mt-1 text-xl font-serif font-medium text-ink">{data.theme}</h1>
        <p className="mt-1 text-xs text-ink-faint">{doneCount}/{data.steps.length} étapes</p>
      </div>

      <ol className="space-y-2">
        {data.steps.map((s, i) => {
          const isCurrent = s === current;
          return (
            <li
              key={i}
              className={`flex items-center justify-between rounded-sm border px-4 py-3 ${
                s.status === "done"
                  ? "border-rule opacity-50"
                  : isCurrent
                  ? "border-pen-blue bg-paper-raised"
                  : "border-rule"
              }`}
            >
              <span className="text-sm text-ink">
                {s.status === "done" ? "✓ " : ""}{s.label}
              </span>
              {isCurrent && (
                <Link
                  href={`${s.route}?session=1`}
                  className="text-sm font-medium text-pen-blue underline"
                >
                  Commencer →
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      {allDone ? (
        <div className="rounded-sm border-2 border-correction-green bg-correction-green-soft px-5 py-4 text-center">
          <p className="text-sm font-medium text-correction-green">
            Jour {data.day} terminé.
          </p>
          <Link href="/" className="mt-2 inline-block text-xs text-ink-faint underline">Retour à l&apos;accueil</Link>
        </div>
      ) : (
        <button
          onClick={() => load("min")}
          className="text-xs text-ink-faint underline hover:text-ink-muted"
        >
          Je n&apos;ai que 10 min
        </button>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="max-w-sm w-full px-6 space-y-6">{children}</div>
    </div>
  );
}
