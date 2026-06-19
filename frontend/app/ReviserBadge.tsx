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
    <span className="ml-2 inline-flex items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-semibold text-white leading-none">
      {count}
    </span>
  );
}
