/**
 * POST /api/query
 *
 * Único endpoint de la API. Recibe una operación SQL y la ejecuta contra Neon.
 * La DATABASE_URL solo existe en las variables de entorno de Vercel — nunca en el instalador.
 *
 * Body: { method: "all" | "get" | "run" | "exec", sql: string, params?: any[] }
 *
 * Respuesta exitosa:
 *   all  → { ok: true, rows: [...] }
 *   get  → { ok: true, row: {...} | null }
 *   run  → { ok: true, changes: N, lastInsertRowid: id | null }
 *   exec → { ok: true }
 */

const { getPool, deserializeParams } = require("./_lib/db");
const { validateApiKey, setCorsHeaders } = require("./_lib/auth");

const VALID_METHODS = ["all", "get", "run", "exec"];

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  // Preflight CORS
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!validateApiKey(req)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const { method, sql, params } = req.body || {};

  if (!method || !sql || typeof sql !== "string") {
    return res.status(400).json({ ok: false, error: "Faltan campos: method y sql son requeridos." });
  }

  if (!VALID_METHODS.includes(method)) {
    return res.status(400).json({ ok: false, error: `Método inválido: ${method}` });
  }

  const pool = getPool();
  const pgParams = deserializeParams(params);

  try {
    // ── exec: DDL multi-sentencia sin parámetros ──────────────────────────
    if (method === "exec") {
      const client = await pool.connect();
      try {
        await client.query(sql);
        return res.json({ ok: true });
      } finally {
        client.release();
      }
    }

    // ── run: INSERT / UPDATE / DELETE ─────────────────────────────────────
    if (method === "run") {
      let finalSql = sql;
      const upper = sql.trimStart().toUpperCase();
      if (upper.startsWith("INSERT") && !upper.includes("RETURNING")) {
        finalSql += " RETURNING id";
      }
      const result = await pool.query(finalSql, pgParams);
      return res.json({
        ok: true,
        changes: result.rowCount ?? 0,
        lastInsertRowid: result.rows?.[0]?.id ?? null,
      });
    }

    // ── get / all: SELECT ─────────────────────────────────────────────────
    const result = await pool.query(sql, pgParams);

    if (method === "get") {
      return res.json({ ok: true, row: result.rows[0] ?? null });
    }

    return res.json({ ok: true, rows: result.rows });

  } catch (err) {
    console.error(`[query] ${method} error:`, err.message);
    return res.status(500).json({
      ok: false,
      error: err.message,
      code: err.code   || null,
      detail: err.detail || null,
    });
  }
};
