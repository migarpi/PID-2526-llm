"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

type Row = {
  message_id: number;
  session_id: number;
  user_id: number;
  sender: "User" | "AI";
  message_text: string;
  created_at: string;
};

type ListResponse = {
  total: number;
  page: number;
  pageSize: number;
  rows: Row[];
};

export default function AdminPage() {
  const apiBase = ""; // mismo dominio (Next API)

  // filtros
  const [sender, setSender] = useState<string>("");
  const [user, setUser] = useState<string>("");
  const [session, setSession] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  function buildQuery(base: string) {
    const p = new URLSearchParams();
    if (sender) p.set("sender", sender);
    if (user) p.set("user", user);
    if (session) p.set("session", session);
    if (q) p.set("q", q);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    return `${base}?${p.toString()}`;
  }

  async function fetchData() {
    setLoading(true);
    try {
      const url = buildQuery("/api/admin/messages");
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  function onApplyFilters(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchData();
  }

  function onReset() {
    setSender("");
    setUser("");
    setSession("");
    setQ("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
    fetchData();
  }

  async function onExport(format: "csv" | "json") {
    const url = buildQuery(`/api/admin/export`);
    const sep = url.includes("?") ? "&" : "?";
    const finalUrl = `${url}${sep}format=${format}`;
    const a = document.createElement("a");
    a.href = finalUrl;
    a.download = `messages.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-6xl p-6 text-gray-900 dark:text-gray-100 bg-white dark:bg-zinc-900 min-h-screen">
      <h1 className="text-2xl font-semibold mb-4">📊 Admin — Mensajes</h1>

      {/* Filtros */}
      <form onSubmit={onApplyFilters} className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
        <select className="border rounded px-2 py-2 dark:bg-zinc-800 dark:border-zinc-700"
          value={sender} onChange={(e) => setSender(e.target.value)}>
          <option value="">Sender (todos)</option>
          <option value="User">User</option>
          <option value="AI">AI</option>
        </select>

        <input className="border rounded px-2 py-2 dark:bg-zinc-800 dark:border-zinc-700"
          placeholder="user_id" value={user} onChange={(e) => setUser(e.target.value)} />

        <input className="border rounded px-2 py-2 dark:bg-zinc-800 dark:border-zinc-700"
          placeholder="session_id" value={session} onChange={(e) => setSession(e.target.value)} />

        <input className="border rounded px-2 py-2 dark:bg-zinc-800 dark:border-zinc-700"
          placeholder="Buscar texto…" value={q} onChange={(e) => setQ(e.target.value)} />

        <input type="date" className="border rounded px-2 py-2 dark:bg-zinc-800 dark:border-zinc-700"
          value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />

        <input type="date" className="border rounded px-2 py-2 dark:bg-zinc-800 dark:border-zinc-700"
          value={dateTo} onChange={(e) => setDateTo(e.target.value)} />

        <div className="col-span-2 md:col-span-6 flex gap-2">
          <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white">Aplicar</button>
          <button type="button" onClick={onReset} className="px-4 py-2 rounded border dark:border-zinc-700">Limpiar</button>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => onExport("csv")} className="px-4 py-2 rounded border dark:border-zinc-700">
              Exportar CSV
            </button>
            <button type="button" onClick={() => onExport("json")} className="px-4 py-2 rounded border dark:border-zinc-700">
              Exportar JSON
            </button>
          </div>
        </div>
      </form>

      {/* Tabla + paginación */}
      <div className="border rounded overflow-hidden dark:border-zinc-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-zinc-800">
            <tr>
              <th className="text-left p-2">ID</th>
              <th className="text-left p-2">Session</th>
              <th className="text-left p-2">User</th>
              <th className="text-left p-2">Sender</th>
              <th className="text-left p-2">Texto</th>
              <th className="text-left p-2">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {!loading && data?.rows?.length ? (
              data.rows.map((r) => (
                <tr key={r.message_id} className="border-t dark:border-zinc-700 align-top">
                  <td className="p-2">{r.message_id}</td>
                  <td className="p-2">{r.session_id}</td>
                  <td className="p-2">{r.user_id}</td>
                  <td className="p-2">{r.sender}</td>
                  <td className="p-2 whitespace-pre-wrap">{r.message_text}</td>
                  <td className="p-2">{format(new Date(r.created_at), "yyyy-MM-dd HH:mm")}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500 dark:text-gray-400">
                  {loading ? "Cargando…" : "Sin resultados"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Controles de paginación */}
      <div className="flex items-center gap-3 mt-3">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Total: {total} — Página {page} de {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="px-3 py-1 rounded border dark:border-zinc-700 disabled:opacity-40"
        >
          ← Anterior
        </button>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="px-3 py-1 rounded border dark:border-zinc-700 disabled:opacity-40"
        >
          Siguiente →
        </button>

        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          className="ml-auto border rounded px-2 py-1 dark:bg-zinc-800 dark:border-zinc-700"
        >
          {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n} / página</option>)}
        </select>
      </div>
    </div>
  );
}