"use client";

import { useState, useEffect } from "react";

type AuthStatus = "checking" | "locked" | "unlocked";
type Tab = "report" | "history" | "notes";

type ReportData = {
  summary: { totalSubmissions: number; totalErrors: number; totalWords: number; weekSubmissions: number; weekErrors: number; weekWords: number };
  skillAccuracy: { reading: number | null; speakingScore: number | null; listening: number | null; writingCount: number };
  topErrors: { tag: string; count: number; category: string; excerpts: string[] }[];
};

type SubmissionEntry = {
  id: string; source: string; prompt: string | null; content: string;
  wordCount: number; metrics: any; createdAt: string; errorCount: number;
  errors: { id: string; errorTag: string; category: string; excerpt: string | null; correction: string; explanation: string }[];
};

const SOURCE_LABELS: Record<string, string> = {
  free_practice: "Écriture", reading_exercise: "Lecture",
  speaking_exercise: "Expression orale", listening_exercise: "Écoute", drill_response: "Exercice",
};

const SOURCE_COLORS: Record<string, string> = {
  free_practice: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  reading_exercise: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400",
  speaking_exercise: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
  listening_exercise: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  drill_response: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
};

const CAT_COLORS: Record<string, string> = {
  grammaire: "bg-red-100 text-red-700", lexique: "bg-blue-100 text-blue-700",
  orthographe: "bg-yellow-100 text-yellow-700", syntaxe: "bg-purple-100 text-purple-700",
  registre: "bg-orange-100 text-orange-700", comprehension: "bg-indigo-100 text-indigo-700",
};

export default function TutorPage() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("report");
  const [passcodeInput, setPasscodeInput] = useState("");
  const [authError, setAuthError] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [history, setHistory] = useState<SubmissionEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [homework, setHomework] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("tutor_auth");
    if (stored?.startsWith("tutor_")) { setToken(stored); setAuthStatus("unlocked"); }
    else setAuthStatus("locked");
  }, []);

  useEffect(() => {
    if (authStatus !== "unlocked") return;
    setDataLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch("/api/tutor/report", { headers }).then((r) => r.json()),
      fetch("/api/tutor/history", { headers }).then((r) => r.json()),
      fetch("/api/tutor/notes", { headers }).then((r) => r.json()),
    ]).then(([r, h, n]) => {
      if (r.summary) setReport(r);
      if (h.submissions) setHistory(h.submissions);
      if (n.note) { setNotes(n.note.notes ?? ""); setHomework(n.note.homework ?? ""); }
    }).finally(() => setDataLoading(false));
  }, [authStatus, token]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true); setAuthError(false);
    try {
      const res = await fetch("/api/tutor/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode: passcodeInput }) });
      const data = await res.json();
      if (!res.ok) { setAuthError(true); return; }
      localStorage.setItem("tutor_auth", data.token);
      setToken(data.token); setAuthStatus("unlocked");
    } catch { setAuthError(true); }
    finally { setAuthLoading(false); }
  }

  async function handleSaveNotes() {
    if (!token) return;
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/tutor/notes", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ notes, homework }) });
      if (!res.ok) { setSaveStatus("idle"); return; }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch { setSaveStatus("idle"); }
  }

  // ── Passcode screen ──────────────────────────────────────────────────────
  if (authStatus === "checking") return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
    </div>
  );

  if (authStatus === "locked") return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border-2 border-amber-200 dark:border-amber-900 bg-white dark:bg-zinc-900 px-8 py-10 space-y-6 shadow-sm">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center mx-auto text-2xl">🔑</div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Espace Tuteur</h1>
            <p className="text-xs text-zinc-400">Entrez le code pour accéder au tableau de bord</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-3">
            <input type="password" value={passcodeInput}
              onChange={(e) => { setPasscodeInput(e.target.value); setAuthError(false); }}
              placeholder="••••••" autoFocus
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-center tracking-widest bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors ${authError ? "border-red-400" : "border-zinc-200 dark:border-zinc-700"}`} />
            {authError && <p className="text-xs text-red-500 text-center">Code incorrect — réessaie</p>}
            <button type="submit" disabled={authLoading || !passcodeInput}
              className="w-full rounded-full bg-amber-500 hover:bg-amber-600 text-white py-2.5 text-sm font-medium transition-colors disabled:opacity-40">
              {authLoading ? "Vérification…" : "Accéder"}
            </button>
          </form>
          <p className="text-center text-xs text-zinc-300 dark:text-zinc-700">Linguistic Twin · Mode tuteur</p>
        </div>
      </div>
    </div>
  );

  // ── Dashboard ────────────────────────────────────────────────────────────
  const tabs: { key: Tab; label: string; emoji: string }[] = [
    { key: "report", label: "Báo cáo", emoji: "📊" },
    { key: "history", label: "Lịch sử bài", emoji: "📋" },
    { key: "notes", label: "Ghi chú & Bài tập", emoji: "✏️" },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium uppercase tracking-widest">Mode tuteur</span>
            </div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Tableau de bord</h1>
          </div>
          <div className="flex items-center gap-4">
            <a href="/report" target="_blank" rel="noopener noreferrer" className="text-xs text-amber-600 hover:text-amber-700 transition-colors">
              Báo cáo in được ↗
            </a>
            <a href="/" className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">← Accueil</a>
            <button onClick={() => { localStorage.removeItem("tutor_auth"); setToken(null); setAuthStatus("locked"); setPasscodeInput(""); }}
              className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">Déconnexion</button>
          </div>
        </div>

        <div className="flex gap-0 border-b border-zinc-200 dark:border-zinc-800">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key
                  ? "border-amber-500 text-amber-600 dark:text-amber-400"
                  : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              }`}>
              <span>{t.emoji}</span>{t.label}
            </button>
          ))}
        </div>

        {dataLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex gap-1">
              {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />)}
            </div>
          </div>
        )}

        {/* ── Báo cáo ── */}
        {!dataLoading && activeTab === "report" && report && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Bài tuần này", value: report.summary.weekSubmissions, sub: `/ ${report.summary.totalSubmissions} tổng cộng` },
                { label: "Lỗi tuần này", value: report.summary.weekErrors, sub: `/ ${report.summary.totalErrors} tổng` },
                { label: "Từ tuần này", value: report.summary.weekWords.toLocaleString(), sub: `/ ${report.summary.totalWords.toLocaleString()} tổng` },
              ].map(({ label, value, sub }) => (
                <div key={label} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4">
                  <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{value}</div>
                  <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-0.5">{label}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">{sub}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Kỹ năng</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Viết", value: `${report.skillAccuracy.writingCount} bài`, dot: "bg-zinc-800 dark:bg-zinc-100" },
                  { label: "Đọc", value: report.skillAccuracy.reading != null ? `${Math.round(report.skillAccuracy.reading * 100)}% chính xác` : "—", dot: "bg-indigo-500" },
                  { label: "Nói", value: report.skillAccuracy.speakingScore != null ? `${report.skillAccuracy.speakingScore.toFixed(1)}/20` : "—", dot: "bg-teal-500" },
                  { label: "Nghe", value: report.skillAccuracy.listening != null ? `${Math.round(report.skillAccuracy.listening * 100)}% chính xác` : "—", dot: "bg-amber-500" },
                ].map(({ label, value, dot }) => (
                  <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                    <div className={`w-2 h-8 rounded-full shrink-0 ${dot}`} />
                    <div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{value}</div>
                      <div className="text-xs text-zinc-400">{label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {report.topErrors.length > 0 && (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Top lỗi (toàn bộ)</h2>
                <div className="space-y-3">
                  {report.topErrors.map((err, i) => {
                    const pct = Math.round((err.count / report.topErrors[0].count) * 100);
                    return (
                      <div key={err.tag} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-400 w-4 text-right">{i + 1}.</span>
                            <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${CAT_COLORS[err.category] ?? "bg-zinc-100 text-zinc-600"}`}>{err.tag}</span>
                          </div>
                          <span className="text-xs text-zinc-500 font-mono">{err.count}×</span>
                        </div>
                        <div className="ml-6 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                          <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        {err.excerpts[0] && <p className="ml-6 text-xs text-zinc-400 italic">« {err.excerpts[0]} »</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Lịch sử bài ── */}
        {!dataLoading && activeTab === "history" && (
          <div className="space-y-2">
            {history.length === 0 && <p className="text-sm text-zinc-400 text-center py-12">Chưa có bài nào.</p>}
            {history.map((s) => (
              <div key={s.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                <button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs rounded-full px-2.5 py-0.5 font-medium shrink-0 ${SOURCE_COLORS[s.source] ?? "bg-zinc-100 text-zinc-600"}`}>
                      {SOURCE_LABELS[s.source] ?? s.source}
                    </span>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {new Date(s.createdAt).toLocaleDateString("vi-VN", { day: "numeric", month: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-zinc-400">{s.wordCount} mots</span>
                    {s.errorCount > 0 && <span className="text-xs bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400 rounded-full px-2 py-0.5">{s.errorCount} lỗi</span>}
                    <span className="text-zinc-300 text-xs">{expandedId === s.id ? "▲" : "▼"}</span>
                  </div>
                </button>
                {expandedId === s.id && (
                  <div className="px-5 pb-5 space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                    {s.prompt && <p className="text-xs text-zinc-400"><span className="font-medium">Sujet : </span>{s.prompt}</p>}
                    {s.source === "free_practice" && (
                      <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {s.content}
                      </div>
                    )}
                    {s.errors.length > 0 && (
                      <div className="space-y-2">
                        {s.errors.map((e) => (
                          <div key={e.id} className="flex items-start gap-2 text-xs">
                            <span className={`rounded-full px-2 py-0.5 font-medium shrink-0 ${CAT_COLORS[e.category] ?? "bg-zinc-100 text-zinc-600"}`}>{e.errorTag}</span>
                            <div className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                              {e.excerpt && <span className="line-through text-red-500 mr-1">"{e.excerpt}"</span>}
                              → <span className="text-green-600 dark:text-green-400">{e.correction}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Ghi chú & Bài tập ── */}
        {!dataLoading && activeTab === "notes" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">📝 Ghi chú buổi học</h2>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5}
                placeholder="Nhận xét buổi học hôm nay, điểm cần tập trung, quan sát về tiến độ…"
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 leading-relaxed" />
            </div>

            <div className="rounded-xl border-2 border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-5 space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">📚 Bài tập giao cho buổi sau</h2>
              <textarea value={homework} onChange={(e) => setHomework(e.target.value)} rows={4}
                placeholder="Viết một đoạn văn về…  /  Luyện nghe chủ đề…  /  Réviser les erreurs de subjonctif…"
                className="w-full rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 leading-relaxed" />
              <p className="text-xs text-amber-600 dark:text-amber-400">💡 Bài tập sẽ hiện ngay trên trang chủ của học sinh.</p>
            </div>

            <button onClick={handleSaveNotes} disabled={saveStatus === "saving"}
              className={`rounded-full px-6 py-2.5 text-sm font-medium transition-all ${
                saveStatus === "saved" ? "bg-green-500 text-white" : "bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40"
              }`}>
              {saveStatus === "saving" ? "Đang lưu…" : saveStatus === "saved" ? "✓ Đã lưu" : "Lưu ghi chú & bài tập"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
