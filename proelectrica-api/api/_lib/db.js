const { Pool } = require("pg");

let pool = null;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL no está configurada en las variables de entorno de Vercel.");
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 8000,
    });
    pool.on("error", (err) => {
      console.error("Pool error (idle client):", err.message);
    });
  }
  return pool;
}

/**
 * Convierte cualquier parámetro que llegue como {type:"Buffer",data:[...]}
 * de vuelta a un Buffer real antes de enviarlo a pg.
 */
function deserializeParam(p) {
  if (p && typeof p === "object" && p.type === "Buffer" && Array.isArray(p.data)) {
    return Buffer.from(p.data);
  }
  return p;
}

function deserializeParams(params) {
  if (!Array.isArray(params) || params.length === 0) return undefined;
  return params.map(deserializeParam);
}

module.exports = { getPool, deserializeParams };
