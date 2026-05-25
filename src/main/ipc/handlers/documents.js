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
    saveDocumentFile,
    readDocumentFile,
    deleteDocumentFile,
    deleteDocumentsForEntity,
    ensureStorageRoot,
    getStorageRoot,
  } = documents;

  ensureStorageRoot();

  function mapDocumentRow(row) {
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      docType: row.doc_type,
      fileName: row.file_name,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      uploadedBy: row.uploaded_by,
      createdAt: row.created_at,
    };
  }

  function getDocumentById(db, id) {
    return db.prepare("SELECT * FROM documents WHERE id = ?").get(Number(id));
  }

  function replaceExistingSignedPermit(db, entityType, entityId, docType) {
    if (entityType !== "external_shipment" || docType !== "permiso_firmado") return;
    const rows = db.prepare(`
      SELECT id, file_path FROM documents
      WHERE entity_type = ? AND entity_id = ? AND doc_type = ?
    `).all(entityType, Number(entityId), docType);
    for (const row of rows) {
      deleteDocumentFile(row.file_path);
      db.prepare("DELETE FROM documents WHERE id = ?").run(row.id);
    }
  }

  function insertDocumentRecord(db, {
    entityType,
    entityId,
    docType,
    fileName,
    mimeType,
    buffer,
  }) {
    if (!ENTITY_TYPES.includes(entityType)) return { ok: false, message: "Tipo de entidad no valido." };
    if (!DOC_TYPES.includes(docType)) return { ok: false, message: "Tipo de documento no valido." };
    if (!isAllowedUpload(fileName, mimeType)) {
      return { ok: false, message: "Formato no permitido. Use PDF, JPG, PNG o WEBP." };
    }
    if (buffer.length > MAX_FILE_BYTES) {
      return { ok: false, message: "El archivo supera el limite de 15 MB." };
    }
    if (entityType === "external_shipment" && docType === "permiso_firmado") {
      if (mimeType !== "application/pdf" && !String(fileName).toLowerCase().endsWith(".pdf")) {
        return { ok: false, message: "El permiso firmado debe ser un archivo PDF." };
      }
    }

    replaceExistingSignedPermit(db, entityType, entityId, docType);

    const relativePath = saveDocumentFile(entityType, entityId, fileName, buffer);
    const actor = auth.getAuthSession()?.username || null;
    const result = db.prepare(`
      INSERT INTO documents (
        entity_type, entity_id, doc_type, file_name, mime_type, file_path, file_size, uploaded_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entityType,
      Number(entityId),
      docType,
      fileName,
      mimeType,
      relativePath,
      buffer.length,
      actor,
      new Date().toISOString()
    );

    logActivity(db, null, "UPLOAD", "documents", result.lastInsertRowid, `${docType} — ${fileName}`);
    const row = getDocumentById(db, result.lastInsertRowid);
    return { ok: true, document: mapDocumentRow(row) };
  }

  ipcMain.handle("documents:list", (_event, { entityType, entityId } = {}) => {
    const denied = denyIfNotAuthenticated();
    if (denied) return denied;
    if (!ENTITY_TYPES.includes(entityType)) return { ok: false, message: "Tipo de entidad no valido." };
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM documents
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY id DESC
    `).all(entityType, Number(entityId));
    return { ok: true, items: rows.map(mapDocumentRow) };
  });

  ipcMain.handle("documents:upload", (_event, payload = {}) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const {
      entityType,
      entityId,
      docType,
      fileName,
      mimeType,
      dataBase64,
    } = payload;
    if (!entityType || !entityId || !docType || !fileName || !dataBase64) {
      return { ok: false, message: "Datos del documento incompletos." };
    }
    let buffer;
    try {
      buffer = Buffer.from(dataBase64, "base64");
    } catch {
      return { ok: false, message: "Archivo no valido." };
    }
    const db = getDatabase();
    return insertDocumentRecord(db, {
      entityType,
      entityId,
      docType,
      fileName,
      mimeType: mimeType || "application/pdf",
      buffer,
    });
  });

  ipcMain.handle("documents:pick-and-upload", async (_event, payload = {}) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const { entityType, entityId, docType } = payload;
    if (!ENTITY_TYPES.includes(entityType)) return { ok: false, message: "Tipo de entidad no valido." };
    if (!DOC_TYPES.includes(docType)) return { ok: false, message: "Tipo de documento no valido." };

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
    const fileName = path.basename(sourcePath);
    const ext = path.extname(fileName).toLowerCase();
    const mimeType =
      ext === ".pdf" ? "application/pdf" :
      ext === ".png" ? "image/png" :
      ext === ".webp" ? "image/webp" :
      "image/jpeg";

    if (!isAllowedUpload(fileName, mimeType)) {
      return { ok: false, message: "Formato no permitido. Use PDF, JPG, PNG o WEBP." };
    }

    const stat = fs.statSync(sourcePath);
    if (stat.size > MAX_FILE_BYTES) {
      return { ok: false, message: "El archivo supera el limite de 15 MB." };
    }

    const db = getDatabase();
    const buffer = fs.readFileSync(sourcePath);
    return insertDocumentRecord(db, {
      entityType,
      entityId,
      docType,
      fileName,
      mimeType,
      buffer,
    });
  });

  ipcMain.handle("documents:get-content", (_event, { id } = {}) => {
    const denied = denyIfNotAuthenticated();
    if (denied) return denied;
    const db = getDatabase();
    const row = getDocumentById(db, id);
    if (!row) return { ok: false, message: "Documento no encontrado." };
    const buffer = readDocumentFile(row.file_path);
    if (!buffer) return { ok: false, message: "Archivo no encontrado en disco." };
    return {
      ok: true,
      document: mapDocumentRow(row),
      dataBase64: buffer.toString("base64"),
    };
  });

  ipcMain.handle("documents:download", async (_event, { id } = {}) => {
    const denied = denyIfNotAuthenticated();
    if (denied) return denied;
    const db = getDatabase();
    const row = getDocumentById(db, id);
    if (!row) return { ok: false, message: "Documento no encontrado." };
    const abs = path.join(getStorageRoot(), row.file_path);
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "Guardar documento",
      defaultPath: row.file_name,
    });
    if (canceled || !filePath) return { ok: false, message: "Cancelado" };
    fs.copyFileSync(abs, filePath);
    return { ok: true };
  });

  ipcMain.handle("documents:delete", (_event, { id } = {}) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    const row = getDocumentById(db, id);
    if (!row) return { ok: false, message: "Documento no encontrado." };
    deleteDocumentFile(row.file_path);
    db.prepare("DELETE FROM documents WHERE id = ?").run(Number(id));
    logActivity(db, null, "DELETE", "documents", id, row.file_name);
    return { ok: true };
  });

  return { deleteDocumentsForEntity };
}

module.exports = registerDocumentsHandlers;
