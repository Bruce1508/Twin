import Link from "next/link";
import { redirect } from "next/navigation";
import ClassroomForms from "./ClassroomForms";
import { getCurrentUser } from "@/lib/current-user";
import { listUserClassrooms } from "@/lib/classroom-service";

export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const memberships = await listUserClassrooms(user.id);

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <header className="mb-10 border-b-3 border-ink pb-8">
        <p className="ledger-label text-action-blue">Espace partagé</p>
        <h1 className="mt-3">Mes classes</h1>
        <p className="mt-5 max-w-2xl text-ink-muted">
          Créez une classe pour accompagner vos élèves, ou saisissez le code donné par votre professeur.
        </p>
      </header>

      <ClassroomForms />

      <section className="mt-12">
        <div className="ledger-heading border-b-3 border-ink pb-4">
          <h2>Classes actives</h2>
          <span className="ledger-label text-ink-faint">{memberships.length} au total</span>
        </div>
        {memberships.length === 0 ? (
          <p className="border-b border-rule py-8 text-ink-muted">Aucune classe pour le moment.</p>
        ) : (
          <div className="border-x-3 border-t-3 border-ink">
            {memberships.map(({ classroom, role }) => (
              <Link
                key={classroom.id}
                href={`/classes/${classroom.id}`}
                className="flex items-center justify-between gap-5 border-b-3 border-ink bg-paper-raised px-5 py-5 hover:bg-paper-sunken"
              >
                <span>
                  <strong className="block text-lg">{classroom.name}</strong>
                  <small className="mt-1 block font-mono uppercase tracking-wider text-ink-faint">
                    {role === "TEACHER" ? "Professeur" : "Élève"}
                  </small>
                </span>
                <span className="font-mono text-xs text-ink-muted">{classroom._count.memberships} membres →</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
