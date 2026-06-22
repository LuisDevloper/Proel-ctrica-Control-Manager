import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { PgDb, Pool } = require('../src/database/pgAdapter.js');
const { DATABASE_URL } = require('../src/database/config.js');

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PgDb(pool);

try {
  await db.exec(`CREATE TABLE IF NOT EXISTS test_conn (id SERIAL PRIMARY KEY, val TEXT)`);
  await db.prepare('INSERT INTO test_conn (val) VALUES (?)').run('hola');
  const row = await db.prepare('SELECT * FROM test_conn ORDER BY id DESC LIMIT 1').get();
  console.log('Tabla creada e insertado:', row);
  await db.prepare('DROP TABLE IF EXISTS test_conn').run();
  console.log('✓ Conexion y operaciones CRUD funcionan correctamente en Neon');
} catch (e) {
  console.error('Error:', e.message);
} finally {
  await pool.end();
}
