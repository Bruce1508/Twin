"use client";

import { useEffect, useState } from "react";

export default function HomeworkBanner() {
  const [homework, setHomework] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tutor/homework")
      .then((r) => r.json())
      .then((data) => {
        const hw = data.homework?.trim();
        if (hw) setHomework(hw);
      })
      .catch(() => {/* show nothing on error */});
  }, []);

  if (!homework) return null;

  return (
    <div className="rounded-xl border-2 border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 px-5 py-4 space-y-1">
      <div className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
        📚 Bài tập từ giáo viên
      </div>
      <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{homework}</p>
    </div>
  );
}
