"use client";

import { useEffect, useRef, useState } from "react";
import { fetchMessages, ChatMessage } from "@/lib/api";

const SESSION_KEY = "chat.sessionId";

export default function Chat() {
  const userId = Number(process.env.NEXT_PUBLIC_USER_ID ?? 1);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:3001";

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  // cargar sessionId guardado
  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) setSessionId(Number(saved));
  }, []);

  // cargar historial si hay sesión
  useEffect(() => {
    (async () => {
      if (!sessionId) return;
      try {
        const hist = await fetchMessages(sessionId, 50);
        setMessages(hist);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [sessionId]);

  // autoscroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput("");
    setLoading(true);

    // 1) pinta el mensaje del usuario
    setMessages((prev) => [
      ...prev,
      { sender: "User", message_text: userText, created_at: new Date().toISOString() },
    ]);

    // 2) placeholder de la IA
    const aiIndex = messages.length + 1;
    setMessages((prev) => [
      ...prev,
      { sender: "AI", message_text: "", created_at: new Date().toISOString() },
    ]);

    try {
      const res = await fetch(`${apiBase}/send_message_stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          session_id: sessionId ?? undefined,
          message: userText,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`stream failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        // Procesar eventos SSE ("data: {...}\n\n")
        const parts = chunk.split("\n\n").filter(Boolean);
        for (const p of parts) {
          if (!p.startsWith("data:")) continue;
          const jsonStr = p.replace(/^data:\s*/, "");
          try {
            const data = JSON.parse(jsonStr);

            // Capturar session_id en el primer evento
            if (data.event === "session" && typeof data.session_id === "number") {
              setSessionId(data.session_id);
              localStorage.setItem(SESSION_KEY, String(data.session_id));
              continue;
            }

            if (data.delta) {
              aiText += data.delta;
              // actualizar el placeholder de la IA
              setMessages((prev) => {
                const copy = [...prev];
                copy[aiIndex] = { ...copy[aiIndex], message_text: aiText };
                return copy;
              });
            } else if (data.event === "done") {
              // opcional: refrescar historial desde el servidor
              // if (sessionId) {
              //   const hist = await fetchMessages(sessionId, 50);
              //   setMessages(hist);
              // }
            } else if (data.event === "error") {
              setMessages((prev) => {
                const copy = [...prev];
                copy[aiIndex] = { ...copy[aiIndex], message_text: `⚠️ ${data.message}` };
                return copy;
              });
            }
          } catch (e) {
            console.error("Bad SSE JSON:", e, jsonStr);
          }
        }
      }
    } catch (e: any) {
      console.error(e);
      setMessages((prev) => {
        const copy = [...prev];
        copy[aiIndex] = { ...copy[aiIndex], message_text: "⚠️ Error en el streaming." };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function resetSession() {
    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    setMessages([]);
  }

  return (
    <div className="mx-auto max-w-3xl h-[100dvh] flex flex-col p-4 text-gray-900 dark:text-gray-100 bg-white dark:bg-zinc-900 transition-colors duration-200">
      {/* Header */}
      <header className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-zinc-700">
        <h1 className="text-xl font-semibold">💬 Chat con Mistral 7B (Streaming)</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Sesión: {sessionId ?? "—"}</span>
          <button
            onClick={resetSession}
            className="px-3 py-1 rounded-xl border border-gray-300 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            title="Borrar session_id local y limpiar conversación"
          >
            Nueva sesión
          </button>
        </div>
      </header>

      {/* Mensajes */}
      <main className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Escribe un mensaje abajo. Guardamos el historial en Postgres y verás la respuesta en streaming.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.sender === "User" ? "justify-end" : "justify-start"}`}>
            <div
              className={`rounded-2xl px-4 py-2 max-w-[80%] shadow-sm ${
                m.sender === "User"
                  ? "bg-gray-900 text-white dark:bg-zinc-700"
                  : "bg-gray-100 text-gray-900 border border-gray-200 dark:bg-zinc-800 dark:text-gray-100 dark:border-zinc-700"
              }`}
            >
              <div className="text-xs opacity-60 mb-0.5">{m.sender}</div>
              <div className="whitespace-pre-wrap">{m.message_text}</div>
            </div>
          </div>
        ))}
        {loading && <div className="text-xs text-gray-500 dark:text-gray-400">Pensando…</div>}
        <div ref={endRef} />
      </main>

      {/* Input */}
      <footer className="pt-2 border-t border-gray-200 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <input
            className="flex-1 border border-gray-300 dark:border-zinc-700 rounded-xl px-3 py-2 outline-none focus:ring focus:ring-blue-200 dark:focus:ring-blue-800 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
            placeholder="Escribe tu mensaje y pulsa Enter…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-4 py-2 rounded-xl text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            Enviar
          </button>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">
          Guardamos la conversación en Postgres. <span className="underline">Nueva sesión</span> limpia el{" "}
          <code className="mx-1">session_id</code> local.
        </p>
      </footer>
    </div>
  );
}