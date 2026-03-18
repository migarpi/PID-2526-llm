import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

/**
 * GET /api/admin/messages?sender=User|AI&user=1&session=2&q=hola&dateFrom=2024-01-01&dateTo=2025-12-31&page=1&pageSize=20
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sender = url.searchParams.get("sender");        // 'User' | 'AI' | null
  const user = url.searchParams.get("user");            // user_id
  const session = url.searchParams.get("session");      // session_id
  const q = url.searchParams.get("q");                  // search text
  const dateFrom = url.searchParams.get("dateFrom");    // YYYY-MM-DD
  const dateTo = url.searchParams.get("dateTo");        // YYYY-MM-DD
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Math.min(Number(url.searchParams.get("pageSize") ?? "20"), 200);

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

  const offset = (page - 1) * pageSize;

  // total
  const countSQL = `
    SELECT COUNT(*)::int AS total
    FROM messages m
    JOIN sessions s ON s.session_id = m.session_id
    ${whereSQL}
  `;
  const client = await pool.connect();
  try {
    const countRes = await client.query(countSQL, vals);
    const total = countRes.rows[0]?.total ?? 0;

    const dataSQL = `
      SELECT
        m.message_id, m.session_id, s.user_id, m.sender,
        m.message_text, m.created_at
      FROM messages m
      JOIN sessions s ON s.session_id = m.session_id
      ${whereSQL}
      ORDER BY m.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    const dataRes = await client.query(dataSQL, vals);

    return NextResponse.json({
      total,
      page,
      pageSize,
      rows: dataRes.rows,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    client.release();
  }
}