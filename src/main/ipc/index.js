const { ipcMain, dialog, app, BrowserWindow } = require("electron");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const { getDatabase, closeDatabaseForFileReplace, reopenDatabase } = require("../../database/db");
const { logInfo, logError } = require("../../services/logger");
const documents = require("../../services/documents");
const auth = require("./auth");
const guards = require("./guards");
const { createSecureLogActivity } = require("./activity");
const equipment = require("../../modules/equipment/canonical");
const shipments = require("../../modules/shipments");
const excelImport = require("../../modules/import/excel");
const inventory = require("../../modules/inventory/movements");

const registerSystemHandlers = require("./handlers/system");
const registerAuthHandlers = require("./handlers/auth");
const registerDashboardHandlers = require("./handlers/dashboard");
const registerMotorsHandlers = require("./handlers/motors");
const registerTurbinasHandlers = require("./handlers/turbinas");
const registerShipmentsHandlers = require("./handlers/shipments");
const registerTechniciansHandlers = require("./handlers/technicians");
const registerMaintenancesHandlers = require("./handlers/maintenances");
const registerFailuresHandlers = require("./handlers/failures");
const registerInventoryHandlers = require("./handlers/inventory");
const registerImportHandlers = require("./handlers/import");
const registerActivityHandlers = require("./handlers/activity");
const registerUsersHandlers = require("./handlers/users");
const registerDocumentsHandlers = require("./handlers/documents");
const registerStorageHandlers   = require("./handlers/storage");
const registerSearchHandlers    = require("./handlers/search");

function registerIpcHandlers() {
  const logActivity = createSecureLogActivity(auth);

  const deps = {
    ipcMain,
    dialog,
    app,
    fs,
    path,
    BrowserWindow,
    bcrypt,
    getDatabase,
    closeDatabaseForFileReplace,
    reopenDatabase,
    logInfo,
    logError,
    guards,
    auth,
    equipment,
    shipments,
    excelImport,
    inventory,
    logActivity,
    documents,
    deleteDocumentsForEntity: documents.deleteDocumentsForEntity,
  };

  registerSystemHandlers(deps);
  registerAuthHandlers(deps);
  registerDashboardHandlers(deps);
  registerMotorsHandlers(deps);
  registerTurbinasHandlers(deps);
  registerShipmentsHandlers(deps);
  registerTechniciansHandlers(deps);
  registerMaintenancesHandlers(deps);
  registerFailuresHandlers(deps);
  registerInventoryHandlers(deps);
  registerImportHandlers(deps);
  registerActivityHandlers(deps);
  registerUsersHandlers(deps);
  registerDocumentsHandlers(deps);
  registerStorageHandlers(deps);
  registerSearchHandlers(deps);
}

module.exports = { registerIpcHandlers };
