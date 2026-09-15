import Link from "next/link";

type AssignmentCardProps = {
  assignment: {
    id: string;
    title: string;
    instructions: string;
    dueAt: Date | null;
    status: "DRAFT" | "PUBLISHED" | "CLOSED";
    _count?: { submissions: number };
  };
  teacher: boolean;
  actions?: React.ReactNode;
};

const STATUS_LABEL = {
  DRAFT: "Brouillon",
  PUBLISHED: "Publié",
  CLOSED: "Fermé",
};

export default function AssignmentCard({ assignment, teacher, actions }: AssignmentCardProps) {
  return (
    <article className="border-b-3 border-ink bg-paper-raised p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="ledger-label text-ink-faint">{STATUS_LABEL[assignment.status]}</p>
          <h3 className="mt-2 font-display text-2xl uppercase">{assignment.title}</h3>
          <p className="mt-3 line-clamp-2 text-sm text-ink-muted">{assignment.instructions}</p>
        </div>
        <div className="text-right font-mono text-xs uppercase tracking-wider text-ink-faint">
          {assignment.dueAt && <p>À rendre {assignment.dueAt.toLocaleDateString("fr-CA")}</p>}
          {teacher && <p className="mt-1">{assignment._count?.submissions ?? 0} réponses</p>}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Link href={`/assignments/${assignment.id}`} className="font-mono text-xs font-bold uppercase underline underline-offset-4">
          Ouvrir →
        </Link>
        {actions}
      </div>
    </article>
  );
}
