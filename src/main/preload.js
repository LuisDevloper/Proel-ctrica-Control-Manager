const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("proelectricaApi", {
  login: (credentials) => ipcRenderer.invoke("auth:login", credentials),
  getDashboardStats: () => ipcRenderer.invoke("dashboard:stats"),
  getMotors: () => ipcRenderer.invoke("motors:list"),
  createMotor: (motor) => ipcRenderer.invoke("motors:create", motor),
  updateMotor: (motor) => ipcRenderer.invoke("motors:update", motor),
  deleteMotor: (id) => ipcRenderer.invoke("motors:delete", id),
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
  getNotifications: () => ipcRenderer.invoke("notifications:list"),
  getDashboardCharts: () => ipcRenderer.invoke("dashboard:charts"),
  getMotorDetail: (id) => ipcRenderer.invoke("motors:detail", id),
  getMaintenancesCalendar: (params) => ipcRenderer.invoke("maintenances:calendar", params),
  dbPing: () => ipcRenderer.invoke("db:ping"),
  getAppInfo: () => ipcRenderer.invoke("app:info"),
  changePassword: (data) => ipcRenderer.invoke("auth:changePassword", data),
  // Importar desde Excel
  parseExcel:       (opts)  => ipcRenderer.invoke("import:parse-excel", opts),
  importMotors:     (data)  => ipcRenderer.invoke("import:save-motors", data),
  importTechnicians:(data)  => ipcRenderer.invoke("import:save-technicians", data),
  // Registro de actividad
  getActivityLog: (opts) => ipcRenderer.invoke("activity:list", opts),
  logActivity:    (data) => ipcRenderer.invoke("activity:log", data),
  // Backup / Restore
  backupDb:  () => ipcRenderer.invoke("db:backup"),
  restoreDb: () => ipcRenderer.invoke("db:restore"),
  // Gestión de usuarios
  getUsers:          ()     => ipcRenderer.invoke("users:list"),
  createUser:        (data) => ipcRenderer.invoke("users:create", data),
  updateUserRole:    (data) => ipcRenderer.invoke("users:update-role", data),
  resetUserPassword: (data) => ipcRenderer.invoke("users:reset-password", data),
  deleteUser:        (id)   => ipcRenderer.invoke("users:delete", id),
  // Auto-updater
  onUpdaterEvent: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on("updater:event", handler);
    return () => ipcRenderer.removeListener("updater:event", handler);
  },
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  installUpdate: () => ipcRenderer.send("updater:install-now")
});
