import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { ClassroomAccessError, getClassroomOverview } from "@/lib/classroom-service";
import AssignmentForm from "./AssignmentForm";

export default async function NewAssignmentPage({ params }: { params: Promise<{ classId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const { classId } = await params;
  let classroomName: string;
  try {
    const overview = await getClassroomOverview(user.id, classId);
    if (!overview.isTeacher) throw new ClassroomAccessError();
    classroomName = overview.classroom.name;
  } catch (error) {
    if (error instanceof ClassroomAccessError) notFound();
    throw error;
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link href={`/classes/${classId}`} className="font-mono text-xs font-bold uppercase tracking-wider underline underline-offset-4">← {classroomName}</Link>
      <header className="my-8 border-b-3 border-ink pb-8">
        <p className="ledger-label text-action-blue">Nouveau devoir</p>
        <h1 className="mt-3">Préparer une consigne</h1>
        <p className="mt-5 text-ink-muted">Le devoir reste invisible aux élèves jusqu’à sa publication.</p>
      </header>
      <AssignmentForm classroomId={classId} />
    </div>
  );
}
