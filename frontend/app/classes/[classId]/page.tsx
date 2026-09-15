import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import {
  ClassroomAccessError,
  ClassroomNotFoundError,
  getClassroomOverview,
} from "@/lib/classroom-service";
import { JoinCodeControls, RemoveStudentButton } from "./ClassroomControls";

export const dynamic = "force-dynamic";

export default async function ClassroomPage({ params }: { params: Promise<{ classId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { classId } = await params;
  let overview;
  try {
    overview = await getClassroomOverview(user.id, classId);
  } catch (error) {
    if (error instanceof ClassroomAccessError || error instanceof ClassroomNotFoundError) notFound();
    throw error;
  }

  const { classroom, isTeacher } = overview;
  const students = isTeacher ? classroom.memberships.filter((item) => item.role === "STUDENT") : [];

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <Link href="/classes" className="font-mono text-xs font-bold uppercase tracking-wider underline underline-offset-4">← Mes classes</Link>
      <header className="mt-8 border-b-3 border-ink pb-8">
        <p className="ledger-label text-action-blue">{isTeacher ? "Espace professeur" : "Espace élève"}</p>
        <h1 className="mt-3">{classroom.name}</h1>
        <p className="mt-5 text-ink-muted">
          {isTeacher ? "Gérez les membres et préparez les prochains devoirs." : "Les devoirs publiés apparaîtront ici."}
        </p>
      </header>

      {isTeacher ? (
        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section>
            <div className="ledger-heading border-b-3 border-ink pb-4">
              <h2>Élèves</h2>
              <span className="ledger-label text-ink-faint">{students.length}</span>
            </div>
            <div className="border-x-3 border-t-3 border-ink">
              {students.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 border-b-3 border-ink bg-paper-raised px-5 py-4">
                  <span>
                    <strong className="block">{item.user.name ?? "Élève"}</strong>
                    <small className="text-ink-muted">{item.user.email}</small>
                  </span>
                  <RemoveStudentButton classroomId={classroom.id} userId={item.user.id} />
                </div>
              ))}
              {students.length === 0 && (
                <p className="border-b-3 border-ink bg-paper-raised px-5 py-8 text-ink-muted">Partagez le code pour inviter vos premiers élèves.</p>
              )}
            </div>
          </section>
          <aside>
            <JoinCodeControls
              key={classroom.joinCode}
              classroomId={classroom.id}
              initialCode={classroom.joinCode}
            />
          </aside>
        </div>
      ) : (
        <section className="mt-10 border-3 border-ink bg-paper-raised p-7">
          <p className="ledger-label text-ink-faint">Devoirs</p>
          <h2 className="mt-3 font-display text-3xl uppercase">Rien à rendre</h2>
          <p className="mt-4 text-ink-muted">Votre professeur n’a pas encore publié de devoir.</p>
        </section>
      )}
    </div>
  );
}
