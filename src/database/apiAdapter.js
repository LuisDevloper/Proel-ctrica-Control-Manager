/**
 * Adaptador HTTP que replica la interfaz de pgAdapter (PgDb / PgStatement)
 * pero enruta todas las consultas al backend en Vercel en lugar de conectarse
 * directamente a Neon.
 *
 * Ventaja de seguridad: config.js solo contiene API_URL + API_KEY.
 * La DATABASE_URL de Neon nunca sale del servidor.
 */

const { API_URL, API_KEY } = require("./config");

// ── Serialización de Buffers ──────────────────────────────────────────────────
// pg devuelve BYTEA como Buffer. Al viajar por JSON se convierte en
// {type:"Buffer",data:[...]}. Las funciones siguientes normalizan esto.

function serializeParams(params) {
  return params.map((p) => {
    if (Buffer.isBuffer(p)) return { type: "Buffer", data: Array.from(p) };
    return p;
  });
}

function deserializeRow(row) {
  if (!row || typeof row !== "object") return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v && typeof v === "object" && v.type === "Buffer" && Array.isArray(v.data)) {
      out[k] = Buffer.from(v.data);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function deserializeRows(rows) {
  return Array.isArray(rows) ? rows.map(deserializeRow) : rows;
}

// ── Cliente HTTP ──────────────────────────────────────────────────────────────

async function apiCall(body) {
  let res;
  try {
    res = await fetch(`${API_URL}/api/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    const e = new Error(
      `No se pudo conectar con el servidor de la aplicación. Verifica tu conexión a internet. (${networkErr.message})`
    );
    e.code = "NETWORK_ERROR";
    throw e;
  }

  const data = await res.json();

  if (!res.ok || data.ok === false) {
    const e = new Error(data.error || `Error HTTP ${res.status}`);
    if (data.code)   e.code   = data.code;
    if (data.detail) e.detail = data.detail;
    throw e;
  }

  return data;
}

// ── PgStatement compatible ────────────────────────────────────────────────────

class ApiStatement {
  constructor(sql) {
    // Convierte ? → $1, $2, ... igual que pgAdapter._pgify()
    let i = 0;
    this._sql = sql.replace(/\?/g, () => `$${++i}`);
  }

  _flatParams(args) {
    const flat = [];
    for (const a of args) {
      if (Array.isArray(a)) flat.push(...a);
      else flat.push(a);
    }
    return flat;
  }

  async all(...args) {
    const params = serializeParams(this._flatParams(args));
    const data = await apiCall({ method: "all", sql: this._sql, params });
    return deserializeRows(data.rows);
  }

  async get(...args) {
    const params = serializeParams(this._flatParams(args));
    const data = await apiCall({ method: "get", sql: this._sql, params });
    return deserializeRow(data.row);
  }

  async run(...args) {
    const params = serializeParams(this._flatParams(args));
    const data = await apiCall({ method: "run", sql: this._sql, params });
    return { changes: data.changes, lastInsertRowid: data.lastInsertRowid };
  }
}

// ── ApiDb (reemplaza PgDb) ────────────────────────────────────────────────────

class ApiDb {
  prepare(sql) {
    return new ApiStatement(sql);
  }

  async exec(sql) {
    await apiCall({ method: "exec", sql });
  }

  /**
   * transaction(): ejecuta las operaciones de fn() de forma secuencial.
   * No hay transacciones reales en HTTP, pero ningún handler actual las usa,
   * así que es seguro. Si en el futuro se necesitan, se puede añadir un
   * endpoint /api/transaction en el backend.
   */
  async transaction(fn) {
    return fn(this);
  }
}

module.exports = { ApiDb };
