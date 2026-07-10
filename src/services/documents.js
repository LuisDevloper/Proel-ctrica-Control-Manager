/**
 * Servicio de documentos adjuntos.
 *
 * Los archivos se guardan como BYTEA en la columna `file_data` de la tabla
 * `documents` en Neon (PostgreSQL), lo que los hace visibles desde cualquier
 * PC con la app instalada.
 *
 * Compatibilidad con versiones anteriores: si `file_data` es NULL el servicio
 * intenta leer el archivo desde el sistema de archivos local (file_path).
 */

const fs   = require("fs");
const path = require("path");
const crypto = require("crypto");
const { app } = require("electron");

const MAX_FILE_BYTES = 15 * 1024 * 1024;  // 15 MB

const ALLOWED_MIME = {
  "application/pdf": [".pdf"],
  "image/jpeg":      [".jpg", ".jpeg"],
  "image/png":       [".png"],
  "image/webp":      [".webp"],
};

const DOC_TYPES    = ["cotizacion", "informe", "orden_trabajo", "permiso_firmado", "foto", "otro"];
const ENTITY_TYPES = ["motor", "maintenance", "turbine", "external_shipment"];

// ── Utilidades ────────────────────────────────────────────────────────────

function sanitizeFileName(name) {
  return String(name || "documento")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120) || "documento";
}

function isAllowedUpload(fileName, mimeType) {
  const ext = path.extname(fileName || "").toLowerCase();
  const allowedExts = ALLOWED_MIME[mimeType];
  if (!allowedExts) return false;
  return allowedExts.includes(ext);
}

/** Genera una clave única de objeto (usada como file_path en la BD). */
function buildStorageKey(entityType, entityId, fileName) {
  const id   = crypto.randomUUID();
  const safe = sanitizeFileName(fileName);
  return `${entityType}/${entityId}/${id}_${safe}`;
}

function formatBytes(bytes) {
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Compatibilidad con almacenamiento local antiguo ───────────────────────

/** Ruta raíz del storage local (usada solo para leer documentos antiguos). */
function getStorageRoot() {
  return path.join(app.getPath("userData"), "storage");
}

/** Lee un archivo desde el sistema de archivos local (fallback legado). */
function readLocalFile(relativePath) {
  try {
    const root = getStorageRoot();
    const abs  = path.resolve(root, relativePath);
    if (!abs.startsWith(root)) return null;
    if (!fs.existsSync(abs))   return null;
    return fs.readFileSync(abs);
  } catch (_) {
    return null;
  }
}

// ── Operaciones de nube (PostgreSQL BYTEA) ───────────────────────────────

/**
 * Guarda el buffer del archivo en la columna `file_data` del registro de
 * documento ya creado en la BD. Retorna la storage key (file_path).
 *
 * @param {object} db         - instancia PgDb
 * @param {number} documentId - ID del registro en `documents`
 * @param {Buffer} buffer     - contenido binario del archivo
 */
async function storeFileData(db, documentId, buffer) {
  await db.prepare(
    "UPDATE documents SET file_data = ? WHERE id = ?"
  ).run(buffer, Number(documentId));
}

/**
 * Lee los datos binarios de un documento desde PostgreSQL.
 * Si `file_data` es NULL intenta leer desde el filesystem local (legado).
 *
 * @param {object} db  - instancia PgDb
 * @param {object} row - fila de la tabla `documents`
 * @returns {Buffer|null}
 */
async function readFileData(db, row) {
  if (row.file_data) {
    return Buffer.isBuffer(row.file_data)
      ? row.file_data
      : Buffer.from(row.file_data);
  }
  // Fallback: archivo guardado localmente en versiones anteriores
  return readLocalFile(row.file_path);
}

/**
 * Elimina los documentos adjuntos a una entidad (registros + datos binarios).
 * Los datos se eliminan automáticamente al borrar el registro (ON DELETE CASCADE
 * no está configurado, pero el campo BYTEA se borra junto con la fila).
 */
async function deleteDocumentsForEntity(db, entityType, entityId) {
  await db.prepare(
    "DELETE FROM documents WHERE entity_type = ? AND entity_id = ?"
  ).run(entityType, Number(entityId));
}

// ── Exports ──────────────────────────────────────────────────────────────

module.exports = {
  MAX_FILE_BYTES,
  ALLOWED_MIME,
  DOC_TYPES,
  ENTITY_TYPES,
  isAllowedUpload,
  buildStorageKey,
  storeFileData,
  readFileData,
  deleteDocumentsForEntity,
  formatBytes,
  // Compatibilidad con código que importa estas funciones (no-ops o getStorageRoot)
  getStorageRoot,
  ensureStorageRoot: () => {},
};
