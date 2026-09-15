import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { ClassroomAccessError } from "@/lib/classroom-service";
import { AssignmentNotFoundError, getAssignmentForMember } from "@/lib/assignments";
import AssignmentForm from "@/app/teacher/classes/[classId]/assignments/new/AssignmentForm";

export default async function EditAssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const { assignmentId } = await params;
  let result;
  try {
    result = await getAssignmentForMember(user.id, assignmentId);
    if (result.membership.role !== "TEACHER" || result.assignment.status !== "DRAFT") notFound();
  } catch (error) {
    if (error instanceof ClassroomAccessError || error instanceof AssignmentNotFoundError) notFound();
    throw error;
  }
  const { assignment } = result;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link href={`/classes/${assignment.classroomId}`} className="font-mono text-xs font-bold uppercase tracking-wider underline underline-offset-4">← {assignment.classroom.name}</Link>
      <header className="my-8 border-b-3 border-ink pb-8">
        <p className="ledger-label text-action-blue">Brouillon</p>
        <h1 className="mt-3">Modifier le devoir</h1>
        <p className="mt-5 text-ink-muted">Les élèves ne voient pas les modifications avant la publication.</p>
      </header>
      <AssignmentForm
        classroomId={assignment.classroomId}
        assignment={{
          id: assignment.id,
          title: assignment.title,
          instructions: assignment.instructions,
          taskType: assignment.taskType,
          dueAt: assignment.dueAt?.toISOString() ?? null,
        }}
      />
    </div>
  );
}
