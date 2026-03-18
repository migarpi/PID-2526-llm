import { Pool } from "pg";

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error("POSTGRES_URL no está definida en .env.local");
}

export const pool = new Pool({
  connectionString,
  // SSL si usas un Postgres gestionado:
  // ssl: { rejectUnauthorized: false },
});