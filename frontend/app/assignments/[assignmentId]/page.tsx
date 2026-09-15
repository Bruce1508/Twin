import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { ClassroomAccessError } from "@/lib/classroom-service";
import { AssignmentNotFoundError, getAssignmentForMember } from "@/lib/assignments";

export default async function AssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const { assignmentId } = await params;
  let result;
  try {
    result = await getAssignmentForMember(user.id, assignmentId);
  } catch (error) {
    if (error instanceof ClassroomAccessError || error instanceof AssignmentNotFoundError) notFound();
    throw error;
  }
  const { assignment, membership } = result;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link href={`/classes/${assignment.classroomId}`} className="font-mono text-xs font-bold uppercase tracking-wider underline underline-offset-4">← {assignment.classroom.name}</Link>
      <header className="mt-8 border-b-3 border-ink pb-8">
        <p className="ledger-label text-action-blue">{assignment.status === "DRAFT" ? "Brouillon" : assignment.status === "CLOSED" ? "Fermé" : "À faire"}</p>
        <h1 className="mt-3">{assignment.title}</h1>
        {assignment.dueAt && <p className="mt-5 font-mono text-xs uppercase tracking-wider">À rendre le {assignment.dueAt.toLocaleString("fr-CA")}</p>}
      </header>
      <section className="mt-8 border-3 border-ink bg-paper-raised p-6 sm:p-9">
        <p className="ledger-label text-ink-faint">Consigne</p>
        <p className="mt-4 whitespace-pre-wrap leading-relaxed">{assignment.instructions}</p>
      </section>
      <section className="mt-8 border-t-3 border-ink pt-6">
        <p className="text-ink-muted">
          {membership.role === "TEACHER"
            ? "Les réponses des élèves et la file de révision seront ajoutées à l’étape suivante."
            : assignment.status === "CLOSED"
              ? "Ce devoir est fermé."
              : "L’espace de réponse sera ajouté à l’étape suivante."}
        </p>
      </section>
    </div>
  );
}
