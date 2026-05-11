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
  // Auto-updater
  onUpdaterEvent: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on("updater:event", handler);
    return () => ipcRenderer.removeListener("updater:event", handler);
  },
  installUpdate: () => ipcRenderer.send("updater:install-now")
});
