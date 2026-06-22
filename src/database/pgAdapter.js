/**
 * Adaptador PostgreSQL que imita la API de better-sqlite3 pero de forma asíncrona.
 * Convierte automáticamente los placeholders ? → $1, $2, ...
 * Agrega RETURNING id a INSERT cuando se llama .run() para obtener lastInsertRowid.
 */

const { Pool } = require("pg");

class PgStatement {
  constructor(querier, sql) {
    this._q = querier;
    this._sql = sql;
  }

  _pgify() {
    let i = 0;
    return this._sql.replace(/\?/g, () => `$${++i}`);
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
    const params = this._flatParams(args);
    const sql = this._pgify();
    const { rows } = await this._q.query(sql, params.length ? params : undefined);
    return rows;
  }

  async get(...args) {
    const params = this._flatParams(args);
    const sql = this._pgify();
    const { rows } = await this._q.query(sql, params.length ? params : undefined);
    return rows[0] ?? null;
  }

  async run(...args) {
    const params = this._flatParams(args);
    let sql = this._pgify();
    const trimUpper = sql.trimStart().toUpperCase();
    if (trimUpper.startsWith("INSERT") && !trimUpper.includes("RETURNING")) {
      sql += " RETURNING id";
    }
    const result = await this._q.query(sql, params.length ? params : undefined);
    return {
      changes: result.rowCount ?? 0,
      lastInsertRowid: result.rows?.[0]?.id ?? null,
    };
  }
}

class PgDb {
  constructor(pool) {
    this._pool = pool;
    this._client = null;
  }

  get _querier() {
    return this._client || this._pool;
  }

  prepare(sql) {
    return new PgStatement(this._querier, sql);
  }

  /** Ejecuta SQL multi-statement (DDL). */
  async exec(sql) {
    const client = await this._pool.connect();
    try {
      await client.query(sql);
    } finally {
      client.release();
    }
  }

  /** Ejecuta una función dentro de una transacción. */
  async transaction(fn) {
    const client = await this._pool.connect();
    try {
      await client.query("BEGIN");
      const txDb = new PgDb(this._pool);
      txDb._client = client;
      const result = await fn(txDb);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}

module.exports = { PgDb, Pool };
