const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { app } = require("electron");

const MAX_FILE_BYTES = 15 * 1024 * 1024;

const ALLOWED_MIME = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

const DOC_TYPES = ["cotizacion", "informe", "orden_trabajo", "permiso_firmado", "otro"];
const ENTITY_TYPES = ["motor", "maintenance", "turbine", "external_shipment"];

function getStorageRoot() {
  return path.join(app.getPath("userData"), "storage");
}

function ensureStorageRoot() {
  const root = getStorageRoot();
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}

function sanitizeFileName(name) {
  return String(name || "documento")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120) || "documento";
}

function extFromMime(mime) {
  const exts = ALLOWED_MIME[mime];
  return exts?.[0] || "";
}

function isAllowedUpload(fileName, mimeType) {
  const ext = path.extname(fileName || "").toLowerCase();
  const allowedExts = ALLOWED_MIME[mimeType];
  if (!allowedExts) return false;
  return allowedExts.includes(ext);
}

function buildRelativePath(entityType, entityId, fileName) {
  const id = crypto.randomUUID();
  const safe = sanitizeFileName(fileName);
  return path.join(entityType, String(entityId), `${id}_${safe}`);
}

function resolveAbsolutePath(relativePath) {
  const root = getStorageRoot();
  const abs = path.resolve(root, relativePath);
  if (!abs.startsWith(root)) throw new Error("Ruta de documento no valida.");
  return abs;
}

function saveDocumentFile(entityType, entityId, fileName, buffer) {
  ensureStorageRoot();
  const relative = buildRelativePath(entityType, entityId, fileName);
  const abs = resolveAbsolutePath(relative);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buffer);
  return relative.replace(/\\/g, "/");
}

function readDocumentFile(relativePath) {
  const abs = resolveAbsolutePath(relativePath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs);
}

function deleteDocumentFile(relativePath) {
  try {
    const abs = resolveAbsolutePath(relativePath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (_) {
    /* ignore missing file */
  }
}

function deleteEntityStorageDir(entityType, entityId) {
  const dir = path.join(getStorageRoot(), entityType, String(entityId));
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

function deleteDocumentsForEntity(db, entityType, entityId) {
  const rows = db.prepare(
    "SELECT id, file_path FROM documents WHERE entity_type = ? AND entity_id = ?"
  ).all(entityType, Number(entityId));
  for (const row of rows) deleteDocumentFile(row.file_path);
  db.prepare("DELETE FROM documents WHERE entity_type = ? AND entity_id = ?").run(
    entityType,
    Number(entityId)
  );
  deleteEntityStorageDir(entityType, entityId);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

module.exports = {
  MAX_FILE_BYTES,
  ALLOWED_MIME,
  DOC_TYPES,
  ENTITY_TYPES,
  getStorageRoot,
  ensureStorageRoot,
  isAllowedUpload,
  saveDocumentFile,
  readDocumentFile,
  deleteDocumentFile,
  deleteDocumentsForEntity,
  formatBytes,
};
