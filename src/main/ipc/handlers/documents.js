function registerDocumentsHandlers({
  ipcMain,
  dialog,
  fs,
  path,
  getDatabase,
  guards,
  auth,
  logActivity,
  documents,
}) {
  const { denyIfNotAuthenticated, denyIfVisor } = guards;
  const {
    MAX_FILE_BYTES,
    DOC_TYPES,
    ENTITY_TYPES,
    isAllowedUpload,
    buildStorageKey,
    storeFileData,
    readFileData,
    deleteDocumentsForEntity,
  } = documents;

  function mapDocumentRow(row) {
    return {
      id:          row.id,
      entityType:  row.entity_type,
      entityId:    row.entity_id,
      docType:     row.doc_type,
      fileName:    row.file_name,
      mimeType:    row.mime_type,
      fileSize:    row.file_size,
      uploadedBy:  row.uploaded_by,
      createdAt:   row.created_at,
    };
  }

  async function getDocumentById(db, id) {
    return await db.prepare("SELECT * FROM documents WHERE id = ?").get(Number(id));
  }

  /** Si ya existe un permiso firmado para el mismo envío, lo elimina antes de subir el nuevo. */
  async function replaceExistingSignedPermit(db, entityType, entityId, docType) {
    if (entityType !== "external_shipment" || docType !== "permiso_firmado") return;
    await db.prepare(`
      DELETE FROM documents
      WHERE entity_type = ? AND entity_id = ? AND doc_type = ?
    `).run(entityType, Number(entityId), docType);
  }

  /**
   * Inserta el registro del documento en la BD y guarda el binario como BYTEA en Neon.
   */
  async function insertDocumentRecord(db, { entityType, entityId, docType, fileName, mimeType, buffer }) {
    if (!ENTITY_TYPES.includes(entityType))
      return { ok: false, message: "Tipo de entidad no valido." };
    if (!DOC_TYPES.includes(docType))
      return { ok: false, message: "Tipo de documento no valido." };
    if (!isAllowedUpload(fileName, mimeType))
      return { ok: false, message: "Formato no permitido. Use PDF, JPG, PNG o WEBP." };
    if (buffer.length > MAX_FILE_BYTES)
      return { ok: false, message: "El archivo supera el limite de 15 MB." };
    if (entityType === "external_shipment" && docType === "permiso_firmado") {
      if (mimeType !== "application/pdf" && !String(fileName).toLowerCase().endsWith(".pdf"))
        return { ok: false, message: "El permiso firmado debe ser un archivo PDF." };
    }

    await replaceExistingSignedPermit(db, entityType, entityId, docType);

    const storageKey = buildStorageKey(entityType, entityId, fileName);
    const actor      = auth.getAuthSession()?.username || null;

    const result = await db.prepare(`
      INSERT INTO documents (
        entity_type, entity_id, doc_type, file_name, mime_type,
        file_path, file_size, uploaded_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entityType,
      Number(entityId),
      docType,
      fileName,
      mimeType,
      storageKey,
      buffer.length,
      actor,
      new Date().toISOString()
    );

    const newId = result.lastInsertRowid;

    // Guardar el binario en la columna file_data (BYTEA)
    await storeFileData(db, newId, buffer);

    await logActivity(db, null, "UPLOAD", "documents", newId, `${docType} — ${fileName}`);
    const row = await getDocumentById(db, newId);
    return { ok: true, document: mapDocumentRow(row) };
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  ipcMain.handle("documents:list", async (_event, { entityType, entityId } = {}) => {
    const denied = denyIfNotAuthenticated();
    if (denied) return denied;
    if (!ENTITY_TYPES.includes(entityType)) return { ok: false, message: "Tipo de entidad no valido." };
    const db = getDatabase();
    // No seleccionamos file_data (puede ser grande); se pide al abrir
    const rows = await db.prepare(`
      SELECT id, entity_type, entity_id, doc_type, file_name, mime_type,
             file_path, file_size, uploaded_by, created_at
      FROM documents
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY id DESC
    `).all(entityType, Number(entityId));
    return { ok: true, items: rows.map(mapDocumentRow) };
  });

  ipcMain.handle("documents:upload", async (_event, payload = {}) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const { entityType, entityId, docType, fileName, mimeType, dataBase64 } = payload;
    if (!entityType || !entityId || !docType || !fileName || !dataBase64)
      return { ok: false, message: "Datos del documento incompletos." };
    let buffer;
    try { buffer = Buffer.from(dataBase64, "base64"); }
    catch { return { ok: false, message: "Archivo no valido." }; }
    const db = getDatabase();
    return await insertDocumentRecord(db, {
      entityType, entityId, docType, fileName,
      mimeType: mimeType || "application/pdf",
      buffer,
    });
  });

  ipcMain.handle("documents:pick-and-upload", async (_event, payload = {}) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const { entityType, entityId, docType } = payload;
    if (!ENTITY_TYPES.includes(entityType)) return { ok: false, message: "Tipo de entidad no valido." };
    if (!DOC_TYPES.includes(docType))       return { ok: false, message: "Tipo de documento no valido." };

    const filters = docType === "permiso_firmado"
      ? [{ name: "PDF", extensions: ["pdf"] }]
      : [{ name: "Documentos", extensions: ["pdf", "jpg", "jpeg", "png", "webp"] }];

    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: "Seleccionar documento",
      filters,
      properties: ["openFile"],
    });
    if (canceled || !filePaths?.length) return { ok: false, message: "Cancelado" };

    const sourcePath = filePaths[0];
    const fileName   = path.basename(sourcePath);
    const ext        = path.extname(fileName).toLowerCase();
    const mimeType   =
      ext === ".pdf"  ? "application/pdf" :
      ext === ".png"  ? "image/png" :
      ext === ".webp" ? "image/webp" :
      "image/jpeg";

    if (!isAllowedUpload(fileName, mimeType))
      return { ok: false, message: "Formato no permitido. Use PDF, JPG, PNG o WEBP." };

    const stat = fs.statSync(sourcePath);
    if (stat.size > MAX_FILE_BYTES)
      return { ok: false, message: "El archivo supera el limite de 15 MB." };

    const buffer = fs.readFileSync(sourcePath);
    const db = getDatabase();
    return await insertDocumentRecord(db, { entityType, entityId, docType, fileName, mimeType, buffer });
  });

  ipcMain.handle("documents:get-content", async (_event, { id } = {}) => {
    const denied = denyIfNotAuthenticated();
    if (denied) return denied;
    const db  = getDatabase();
    const row = await db.prepare("SELECT * FROM documents WHERE id = ?").get(Number(id));
    if (!row) return { ok: false, message: "Documento no encontrado." };
    const buffer = await readFileData(db, row);
    if (!buffer) return { ok: false, message: "Archivo no disponible." };
    return {
      ok: true,
      document: mapDocumentRow(row),
      dataBase64: buffer.toString("base64"),
    };
  });

  ipcMain.handle("documents:download", async (_event, { id } = {}) => {
    const denied = denyIfNotAuthenticated();
    if (denied) return denied;
    const db  = getDatabase();
    const row = await db.prepare("SELECT * FROM documents WHERE id = ?").get(Number(id));
    if (!row) return { ok: false, message: "Documento no encontrado." };

    const buffer = await readFileData(db, row);
    if (!buffer) return { ok: false, message: "Archivo no disponible." };

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "Guardar documento",
      defaultPath: row.file_name,
    });
    if (canceled || !filePath) return { ok: false, message: "Cancelado" };
    fs.writeFileSync(filePath, buffer);
    return { ok: true };
  });

  ipcMain.handle("documents:delete", async (_event, { id } = {}) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db  = getDatabase();
    const row = await getDocumentById(db, id);
    if (!row) return { ok: false, message: "Documento no encontrado." };
    await db.prepare("DELETE FROM documents WHERE id = ?").run(Number(id));
    await logActivity(db, null, "DELETE", "documents", id, row.file_name);
    return { ok: true };
  });

  return { deleteDocumentsForEntity };
}

module.exports = registerDocumentsHandlers;
