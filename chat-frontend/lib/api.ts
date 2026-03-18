export interface SendMessageBody {
  user_id: number;
  message: string;
  session_id?: number | null;
}

export interface SendMessageResponse {
  ai_response: string;
  session_id: number;
}

export interface ChatMessage {
  sender: "User" | "AI";
  message_text: string;
  created_at?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:3001";

export async function sendMessage(body: SendMessageBody): Promise<SendMessageResponse> {
  const res = await fetch(`${API_BASE}/send_message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`send_message failed: ${res.status}`);
  return res.json();
}

export async function fetchMessages(sessionId: number, limit = 50): Promise<ChatMessage[]> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/messages?limit=${limit}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`get_messages failed: ${res.status}`);
  return res.json();
}
