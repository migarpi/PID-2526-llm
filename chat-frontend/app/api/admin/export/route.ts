import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { Parser } from "json2csv";

/**
 * GET /api/admin/export?format=csv|json&...mismos filtros que /messages
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") || "csv").toLowerCase();

  const sender = url.searchParams.get("sender");
  const user = url.searchParams.get("user");
  const session = url.searchParams.get("session");
  const q = url.searchParams.get("q");
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");

  const where: string[] = [];
  const vals: any[] = [];
  let i = 1;

  if (sender && (sender === "User" || sender === "AI")) {
    where.push(`m.sender = $${i++}`);
    vals.push(sender);
  }
  if (user) {
    where.push(`s.user_id = $${i++}`);
    vals.push(Number(user));
  }
  if (session) {
    where.push(`m.session_id = $${i++}`);
    vals.push(Number(session));
  }
  if (q) {
    where.push(`m.message_text ILIKE $${i++}`);
    vals.push(`%${q}%`);
  }
  if (dateFrom) {
    where.push(`m.created_at >= $${i++}`);
    vals.push(`${dateFrom} 00:00:00+00`);
  }
  if (dateTo) {
    where.push(`m.created_at <= $${i++}`);
    vals.push(`${dateTo} 23:59:59+00`);
  }

  const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `
    SELECT
      m.message_id, m.session_id, s.user_id, m.sender,
      m.message_text, m.created_at
    FROM messages m
    JOIN sessions s ON s.session_id = m.session_id
    ${whereSQL}
    ORDER BY m.created_at DESC
    LIMIT 50000
  `;

  const client = await pool.connect();
  try {
    const { rows } = await client.query(sql, vals);

    if (format === "json") {
      return new NextResponse(JSON.stringify(rows, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="messages.json"`,
        },
      });
    }

    // CSV por defecto
    const parser = new Parser({
      fields: ["message_id", "session_id", "user_id", "sender", "message_text", "created_at"],
    });
    const csv = parser.parse(rows);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="messages.csv"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    client.release();
  }
}