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
    <div className="border-2 border-ink bg-paper-raised px-5 py-4 space-y-1">
      <div className="font-mono text-xs font-bold uppercase tracking-widest text-correction-red">
        Bài tập từ giáo viên
      </div>
      <p className="text-sm text-ink-muted whitespace-pre-wrap leading-relaxed">{homework}</p>
    </div>
  );
}
