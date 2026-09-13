"use client";

import { useEffect, useState } from "react";

export default function ReviserBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch("/api/flashcards")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.due)) setCount(data.due.length);
      })
      .catch(() => {/* show nothing on error */});
  }, []);

  if (count === 0) return null;

  return (
    <span className="ml-auto inline-flex min-w-5 items-center justify-center border border-current px-1.5 py-0.5 font-mono text-[9px] font-bold leading-none">
      {count}
    </span>
  );
}
