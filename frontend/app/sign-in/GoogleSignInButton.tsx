"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function GoogleSignInButton({ configured }: { configured: boolean }) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
      if (result.error) {
        setError("Connexion indisponible. Réessayez dans quelques instants.");
      }
    } catch {
      setError("Impossible de contacter le service de connexion.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    setLoading(true);
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("Impossible de fermer la session.");
        setLoading(false);
        return;
      }
      router.push("/sign-in");
      router.refresh();
    } catch {
      setError("Impossible de fermer la session.");
      setLoading(false);
    }
  }

  if (sessionPending) {
    return <p className="mt-8 font-mono text-xs uppercase tracking-wider text-ink-faint">Vérification…</p>;
  }

  if (session?.user) {
    return (
      <div className="mt-8 border-t-3 border-ink pt-6">
        <p className="text-sm font-semibold text-ink">{session.user.name ?? session.user.email}</p>
        <p className="mt-1 text-sm text-ink-muted">{session.user.email}</p>
        <button
          type="button"
          onClick={signOut}
          disabled={loading}
          className="mt-5 border-3 border-ink bg-paper-raised px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider text-ink hover:bg-ink hover:text-paper-raised disabled:border-rule disabled:bg-paper-sunken disabled:text-ink-faint"
        >
          {loading ? "Déconnexion…" : "Se déconnecter"}
        </button>
        {error && <p className="mt-4 text-sm text-correction-red" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={loading || !configured}
        className="border-3 border-ink bg-ink px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider text-paper-raised hover:bg-paper-raised hover:text-ink disabled:border-rule disabled:bg-paper-sunken disabled:text-ink-faint"
      >
        {loading ? "Connexion…" : "Continuer avec Google"}
      </button>
      {!configured && (
        <p className="mt-4 text-sm text-ink-muted">
          La connexion Google n&apos;est pas encore configurée sur cet environnement.
        </p>
      )}
      {error && <p className="mt-4 text-sm text-correction-red" role="alert">{error}</p>}
    </div>
  );
}
