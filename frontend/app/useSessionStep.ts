"use client";

import { useSearchParams, useRouter } from "next/navigation";

export function useSessionStep() {
  const params = useSearchParams();
  const router = useRouter();
  const inSession = params.get("session") === "1";

  async function completeStep() {
    try {
      await fetch("/api/today/advance", { method: "POST" });
    } catch (e) {
      console.error("advance failed:", e);
    }
    router.push("/today");
  }

  return { inSession, completeStep };
}
