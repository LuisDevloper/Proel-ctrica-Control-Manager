/**
 * Handlers IPC para gestión de almacenamiento y limpieza de documentos.
 *
 * Canales expuestos:
 *   storage:stats          — Estadísticas de uso (conteo, bytes, huérfanos)
 *   storage:list-heavy     — Documentos ordenados de mayor a menor tamaño
 *   storage:orphans        — Documentos cuyo equipo/entidad ya fue eliminado
 *   storage:delete-many    — Eliminar varios documentos por ID (array)
 */
function registerStorageHandlers({ ipcMain, getDatabase, guards, auth, logActivity }) {
  const { denyIfNotAuthenticated, denyIfVisor } = guards;

  /**
   * Mapea entity_type al nombre de tabla para la detección de huérfanos.
   * Actualizar aquí si se agregan nuevos tipos de entidad.
   */
  const ENTITY_TABLE = {
    motor:             "motors",
    maintenance:       "maintenances",
    turbine:           "turbinas",
    external_shipment: "external_workshop_shipments",
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Construye el WHERE para detectar documentos huérfanos. */
  function buildOrphanCondition() {
    return Object.entries(ENTITY_TABLE)
      .map(([type, table]) =>
        `(d.entity_type = '${type}' AND NOT EXISTS ` +
        `(SELECT 1 FROM ${table} WHERE id = d.entity_id))`
      )
      .join("\n  OR ");
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  /**
   * storage:stats
   * Devuelve métricas de uso de almacenamiento de documentos.
   */
  ipcMain.handle("storage:stats", async () => {
    const denied = denyIfNotAuthenticated();
    if (denied) return denied;

    const db = getDatabase();

    const totals = await db.prepare(`
      SELECT
        COUNT(*)                                          AS total_count,
        COALESCE(SUM(file_size), 0)                      AS total_bytes,
        COUNT(CASE WHEN file_data IS NOT NULL THEN 1 END) AS cloud_count
      FROM documents
    `).get();

    const orphanWhere = buildOrphanCondition();
    const orphans = await db.prepare(`
      SELECT
        COUNT(*)                       AS orphan_count,
        COALESCE(SUM(d.file_size), 0)  AS orphan_bytes
      FROM documents d
      WHERE ${orphanWhere}
    `).get();

    return {
      ok:          true,
      totalCount:  Number(totals.total_count),
      totalBytes:  Number(totals.total_bytes),
      cloudCount:  Number(totals.cloud_count),
      orphanCount: Number(orphans.orphan_count),
      orphanBytes: Number(orphans.orphan_bytes),
    };
  });

  /**
   * storage:list-heavy
   * Devuelve los N documentos más pesados (sin el binario, solo metadata).
   */
  ipcMain.handle("storage:list-heavy", async (_event, { limit = 20 } = {}) => {
    const denied = denyIfNotAuthenticated();
    if (denied) return denied;

    const db = getDatabase();
    const rows = await db.prepare(`
      SELECT id, entity_type, entity_id, file_name, mime_type,
             file_size, uploaded_by, created_at
      FROM documents
      ORDER BY file_size DESC
      LIMIT ?
    `).all(Math.min(Number(limit) || 20, 50));

    return {
      ok: true,
      items: rows.map((r) => ({
        id:         r.id,
        entityType: r.entity_type,
        entityId:   r.entity_id,
        fileName:   r.file_name,
        mimeType:   r.mime_type,
        sizeBytes:  Number(r.file_size || 0),
        uploadedBy: r.uploaded_by,
        createdAt:  r.created_at,
      })),
    };
  });

  /**
   * storage:orphans
   * Devuelve documentos cuya entidad padre ya no existe en la base de datos.
   */
  ipcMain.handle("storage:orphans", async () => {
    const denied = denyIfNotAuthenticated();
    if (denied) return denied;

    const db = getDatabase();
    const orphanWhere = buildOrphanCondition();

    const rows = await db.prepare(`
      SELECT d.id, d.entity_type, d.entity_id, d.file_name,
             d.mime_type, d.file_size, d.uploaded_by, d.created_at
      FROM documents d
      WHERE ${orphanWhere}
      ORDER BY d.file_size DESC
    `).all();

    return {
      ok: true,
      items: rows.map((r) => ({
        id:         r.id,
        entityType: r.entity_type,
        entityId:   r.entity_id,
        fileName:   r.file_name,
        mimeType:   r.mime_type,
        sizeBytes:  Number(r.file_size || 0),
        uploadedBy: r.uploaded_by,
        createdAt:  r.created_at,
      })),
    };
  });

  /**
   * storage:delete-many
   * Elimina varios documentos por ID de forma atómica.
   */
  ipcMain.handle("storage:delete-many", async (_event, { ids = [] } = {}) => {
    const denied = denyIfVisor();
    if (denied) return denied;

    if (!Array.isArray(ids) || ids.length === 0)
      return { ok: false, message: "No se especificaron documentos." };

    const sanitized = ids.map(Number).filter((n) => Number.isFinite(n) && n > 0);
    if (sanitized.length === 0)
      return { ok: false, message: "IDs no válidos." };

    const db = getDatabase();
    const placeholders = sanitized.map((_, i) => `$${i + 1}`).join(", ");
    await db.prepare(`DELETE FROM documents WHERE id IN (${placeholders})`).run(...sanitized);

    const actor = auth.getAuthSession()?.username || "sistema";
    await logActivity(
      db, null, "DELETE", "documents", null,
      `Limpieza de almacenamiento: ${sanitized.length} documento(s) eliminado(s) por ${actor}`
    );

    return { ok: true, deleted: sanitized.length };
  });
}

module.exports = registerStorageHandlers;
