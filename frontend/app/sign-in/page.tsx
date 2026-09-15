import GoogleSignInButton from "./GoogleSignInButton";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  const googleConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl items-center px-5 py-12">
      <section lang="fr" className="w-full border-3 border-ink bg-paper-raised p-7 sm:p-10">
        <p className="ledger-label text-accent">Espace de classe</p>
        <h1 className="mt-3 font-display text-4xl uppercase sm:text-5xl">Se connecter</h1>
        <p className="mt-5 max-w-md text-ink-muted">
          Utilisez votre compte Google pour retrouver votre classe et votre progression personnelle.
        </p>

        <GoogleSignInButton configured={googleConfigured} />
      </section>
    </div>
  );
}
