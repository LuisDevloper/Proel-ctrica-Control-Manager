const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("proelectricaApi", {
  login: (credentials) => ipcRenderer.invoke("auth:login", credentials),
  logout: () => ipcRenderer.invoke("auth:logout"),
  getDashboardStats: () => ipcRenderer.invoke("dashboard:stats"),
  getMotors: () => ipcRenderer.invoke("motors:list"),
  createMotor: (motor) => ipcRenderer.invoke("motors:create", motor),
  updateMotor: (motor) => ipcRenderer.invoke("motors:update", motor),
  deleteMotor: (id) => ipcRenderer.invoke("motors:delete", id),
  getTurbinas: () => ipcRenderer.invoke("turbinas:list"),
  getTurbinaDetail: (id) => ipcRenderer.invoke("turbinas:detail", id),
  createTurbina: (data) => ipcRenderer.invoke("turbinas:create", data),
  updateTurbina: (data) => ipcRenderer.invoke("turbinas:update", data),
  deleteTurbina: (id) => ipcRenderer.invoke("turbinas:delete", id),
  getExternalShipments: () => ipcRenderer.invoke("external-shipments:list"),
  createExternalShipment: (data) => ipcRenderer.invoke("external-shipments:create", data),
  updateExternalShipment: (data) => ipcRenderer.invoke("external-shipments:update", data),
  deleteExternalShipment: (id) => ipcRenderer.invoke("external-shipments:delete", id),
  getTechnicians: () => ipcRenderer.invoke("technicians:list"),
  createTechnician: (technician) => ipcRenderer.invoke("technicians:create", technician),
  updateTechnician: (technician) => ipcRenderer.invoke("technicians:update", technician),
  deleteTechnician: (id) => ipcRenderer.invoke("technicians:delete", id),
  getMaintenances: () => ipcRenderer.invoke("maintenances:list"),
  createMaintenance: (maintenance) => ipcRenderer.invoke("maintenances:create", maintenance),
  updateMaintenance: (maintenance) => ipcRenderer.invoke("maintenances:update", maintenance),
  deleteMaintenance: (id) => ipcRenderer.invoke("maintenances:delete", id),
  getFailures: () => ipcRenderer.invoke("failures:list"),
  createFailure: (failure) => ipcRenderer.invoke("failures:create", failure),
  updateFailure: (failure) => ipcRenderer.invoke("failures:update", failure),
  deleteFailure: (id) => ipcRenderer.invoke("failures:delete", id),
  getInventoryItems: () => ipcRenderer.invoke("inventory:list"),
  createInventoryItem: (item) => ipcRenderer.invoke("inventory:create", item),
  updateInventoryItem: (item) => ipcRenderer.invoke("inventory:update", item),
  deleteInventoryItem: (id) => ipcRenderer.invoke("inventory:delete", id),
  getInventoryMovements: (opts) => ipcRenderer.invoke("inventory:movements:list", opts),
  createInventoryMovement: (data) => ipcRenderer.invoke("inventory:movements:create", data),
  getNotifications: () => ipcRenderer.invoke("notifications:list"),
  getDashboardCharts: (opts) => ipcRenderer.invoke("dashboard:charts", opts),
  getMotorDetail: (id) => ipcRenderer.invoke("motors:detail", id),
  getMaintenancesCalendar: (params) => ipcRenderer.invoke("maintenances:calendar", params),
  dbPing: () => ipcRenderer.invoke("db:ping"),
  getAppInfo: () => ipcRenderer.invoke("app:info"),
  toggleFullscreen: () => ipcRenderer.invoke("window:toggleFullscreen"),
  isFullscreen: () => ipcRenderer.invoke("window:isFullscreen"),
  changePassword: (data) => ipcRenderer.invoke("auth:changePassword", data),
  // Importar desde Excel
  parseExcel:       (opts)  => ipcRenderer.invoke("import:parse-excel", opts),
  importMotors:     (data)  => ipcRenderer.invoke("import:save-motors", data),
  importTechnicians:(data)  => ipcRenderer.invoke("import:save-technicians", data),
  importTurbinas:   (data)  => ipcRenderer.invoke("import:save-turbinas", data),
  // Registro de actividad
  getActivityLog: (opts) => ipcRenderer.invoke("activity:list", opts),
  // Backup / Restore
  backupDb:  () => ipcRenderer.invoke("db:backup"),
  restoreDb: () => ipcRenderer.invoke("db:restore"),
  // Gestión de usuarios
  getUsers:          ()     => ipcRenderer.invoke("users:list"),
  createUser:        (data) => ipcRenderer.invoke("users:create", data),
  updateUserRole:    (data) => ipcRenderer.invoke("users:update-role", data),
  resetUserPassword: (data) => ipcRenderer.invoke("users:reset-password", data),
  deleteUser:        (id)   => ipcRenderer.invoke("users:delete", id),
  // Documentos adjuntos
  listDocuments:     (opts) => ipcRenderer.invoke("documents:list", opts),
  pickAndUploadDocument: (opts) => ipcRenderer.invoke("documents:pick-and-upload", opts),
  uploadDocument: (opts) => ipcRenderer.invoke("documents:upload", opts),
  getDocumentContent: (opts) => ipcRenderer.invoke("documents:get-content", opts),
  downloadDocument:  (opts) => ipcRenderer.invoke("documents:download", opts),
  deleteDocument:    (opts) => ipcRenderer.invoke("documents:delete", opts),
  // Auto-updater
  onUpdaterEvent: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on("updater:event", handler);
    return () => ipcRenderer.removeListener("updater:event", handler);
  },
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  getPendingInstall: () => ipcRenderer.invoke("updater:getPendingInstall"),
  getUpdaterReleaseNotes: (version) => ipcRenderer.invoke("updater:getReleaseNotes", version),
  installUpdate: () => ipcRenderer.send("updater:install-now"),
  onMenuAction: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on("app:menu-action", handler);
    return () => ipcRenderer.removeListener("app:menu-action", handler);
  },
});
