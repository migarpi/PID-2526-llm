import os
import json
import asyncio
from typing import Optional, List, Literal, AsyncGenerator

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import databases
import httpx

# ========= Carga de configuración =========
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")  # p.ej. postgresql://user:password@localhost:5432/chatdb
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
MODEL = os.getenv("MODEL", "mistral")     # nombre del modelo en Ollama
CONTEXT_LIMIT = int(os.getenv("CONTEXT_LIMIT", "12"))

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL no definida en .env")

# ========= Conexión BD =========
db = databases.Database(DATABASE_URL)

# ========= FastAPI =========
app = FastAPI(title="Chat LLM Stateful API (Mistral 7B via Ollama)")

# CORS para permitir llamadas desde Next.js local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========= Modelos =========
class MessageRequest(BaseModel):
    user_id: int
    session_id: Optional[int] = None
    message: str

class AIResponse(BaseModel):
    ai_response: str
    session_id: int

class MessageOut(BaseModel):
    sender: Literal["User", "AI"]
    message_text: str
    created_at: Optional[str] = None

# ========= Utilidades BD =========
async def recent_messages(session_id: int, limit: int) -> List[MessageOut]:
    rows = await db.fetch_all(
        """
        SELECT sender, message_text, created_at
        FROM messages
        WHERE session_id = :sid
        ORDER BY created_at DESC
        LIMIT :lim
        """,
        values={"sid": session_id, "lim": limit},
    )
    # Devolver en orden cronológico ascendente
    return [MessageOut(sender=r["sender"], message_text=r["message_text"], created_at=str(r["created_at"]))
            for r in rows][::-1]

async def ensure_session(user_id: int, session_id: Optional[int]) -> int:
    if session_id:
        exists = await db.fetch_one(
            "SELECT session_id FROM sessions WHERE session_id = :sid AND user_id = :uid",
            {"sid": session_id, "uid": user_id},
        )
        if not exists:
            raise HTTPException(status_code=404, detail="La sesión no existe o no pertenece al usuario")
        return session_id
    # Crear una sesión nueva si no se proporcionó
    new_id = await db.execute(
        "INSERT INTO sessions (user_id, start_time) VALUES (:uid, CURRENT_TIMESTAMP) RETURNING session_id",
        {"uid": user_id},
    )
    return new_id

async def save_message(session_id: int, sender: str, text: str):
    await db.execute(
        """
        INSERT INTO messages (session_id, sender, message_text)
        VALUES (:sid, :sender, :text)
        """,
        {"sid": session_id, "sender": sender, "text": text},
    )

def to_chat(history: List[MessageOut], user_msg: str) -> List[dict]:
    msgs = [{"role": "system", "content": "Eres un asistente útil y conciso. Responde en el mismo idioma del usuario."}]
    for m in history:
        msgs.append({"role": "user" if m.sender == "User" else "assistant", "content": m.message_text})
    msgs.append({"role": "user", "content": user_msg})
    return msgs

# ========= Llamadas a Ollama =========
async def call_mistral_non_stream(messages: List[dict]) -> str:
    """
    Llamada no-stream a Ollama /api/chat. Devuelve el texto completo.
    """
    url = f"{OLLAMA_HOST}/api/chat"
    payload = {
        "model": MODEL,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.5,
            "num_ctx": 4096,
        },
    }
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        content = data.get("message", {}).get("content") or data.get("response") or ""
        return content.strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ollama/Mistral error: {e}")

async def ollama_stream_chat(messages: List[dict]) -> AsyncGenerator[str, None]:
    """
    Conecta a Ollama /api/chat con stream=True y va rindiendo 'data: <json>\\n\\n' (SSE).
    """
    url = f"{OLLAMA_HOST}/api/chat"
    payload = {
        "model": MODEL,
        "messages": messages,
        "stream": True,
        "options": {
            "temperature": 0.5,
            "num_ctx": 4096,
        },
    }
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("POST", url, json=payload) as r:
            r.raise_for_status()
            async for raw_chunk in r.aiter_bytes():
                for line in raw_chunk.decode("utf-8", errors="ignore").splitlines():
                    if not line.strip():
                        continue
                    # Cada línea debería ser JSON con {"message":{"content":"..."}, "done":bool}
                    try:
                        obj = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    delta = ""
                    if "message" in obj and obj["message"] and "content" in obj["message"]:
                        delta = obj["message"]["content"]
                    if delta:
                        yield f"data: {json.dumps({'delta': delta})}\n\n"
                    if obj.get("done"):
                        yield f"data: {json.dumps({'event': 'done'})}\n\n"
                        return

# ========= Ciclo de vida =========
@app.on_event("startup")
async def startup():
    await db.connect()

@app.on_event("shutdown")
async def shutdown():
    await db.disconnect()

# ========= Endpoints =========
@app.get("/health")
async def health():
    result = {"status": "ok", "db": False, "ollama": False}
    try:
        row = await db.fetch_one("SELECT 1 as ok")
        result["db"] = bool(row and row["ok"] == 1)
    except Exception as e:
        result["db"] = False
        result["db_error"] = str(e)

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            pong = await client.get(f"{OLLAMA_HOST}/api/tags")
        result["ollama"] = pong.status_code == 200
    except Exception as e:
        result["ollama"] = False
        result["ollama_error"] = str(e)

    return result

@app.get("/sessions/{session_id}/messages", response_model=List[MessageOut])
async def get_messages(session_id: int, limit: int = 50):
    return await recent_messages(session_id, min(limit, 200))

@app.post("/send_message", response_model=AIResponse)
async def send_message(req: MessageRequest):
    sid = await ensure_session(req.user_id, req.session_id)
    await save_message(sid, "User", req.message)

    history = await recent_messages(sid, CONTEXT_LIMIT)
    chat_messages = to_chat(history, req.message)

    ai_text = await call_mistral_non_stream(chat_messages)
    await save_message(sid, "AI", ai_text)
    return AIResponse(ai_response=ai_text, session_id=sid)

@app.post("/send_message_stream")
async def send_message_stream(req: MessageRequest):
    sid = await ensure_session(req.user_id, req.session_id)
    await save_message(sid, "User", req.message)

    history = await recent_messages(sid, CONTEXT_LIMIT)
    chat_messages = to_chat(history, req.message)

    accumulated = {"text": ""}

    async def event_gen() -> AsyncGenerator[str, None]:
        # Envía primero el session_id para que el frontend lo persista
        yield f"data: {json.dumps({'event': 'session', 'session_id': sid})}\n\n"

        try:
            async for sse in ollama_stream_chat(chat_messages):
                # sse = "data: {...}\n\n"
                try:
                    payload = sse.strip()[len("data: "):]
                    data = json.loads(payload)
                    if "delta" in data:
                        accumulated["text"] += data["delta"]
                except Exception:
                    pass
                yield sse
        except Exception as e:
            err = json.dumps({"event": "error", "message": str(e)})
            yield f"data: {err}\n\n"
        finally:
            # Guarda la respuesta generada si la hay
            if accumulated["text"]:
                await save_message(sid, "AI", accumulated["text"])

    return StreamingResponse(event_gen(), media_type="text/event-stream")