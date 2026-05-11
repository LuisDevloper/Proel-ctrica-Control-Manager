const appElement = document.getElementById("app");
let currentUser = null;
let currentView = "dashboard";
let filters = {};
let pagination = {};
let editorState = { module: null, id: null };
let isSidebarHidden = false;
const VIEW_LABELS = {
  dashboard: "Dashboard",
  motores: "Motores",
  mantenimientos: "Mantenimientos",
  fallas: "Fallas",
  tecnicos: "Tecnicos",
  inventario: "Inventario"
};

try {
  isSidebarHidden = window.localStorage.getItem("pcm.sidebarHidden") === "1";
} catch (error) {
  isSidebarHidden = false;
}

function persistSidebarState() {
  try {
    window.localStorage.setItem("pcm.sidebarHidden", isSidebarHidden ? "1" : "0");
  } catch (error) {
    return;
  }
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("visible"), 10);
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}

function showValidation(message) {
  showToast(message, "warning");
}

function showLoginSuccessAlert() {
  return new Promise((resolve) => {
    const alert = document.createElement("div");
    alert.className = "login-success-alert";
    alert.innerHTML = `
      <div class="login-success-icon">✓</div>
      <div>
        <strong>Inicio de sesion exitoso</strong>
        <div class="muted">Cargando dashboard...</div>
      </div>
    `;
    document.body.appendChild(alert);

    requestAnimationFrame(() => {
      alert.classList.add("visible");
    });

    setTimeout(() => {
      alert.classList.remove("visible");
      setTimeout(() => {
        alert.remove();
        resolve();
      }, 250);
    }, 1150);
  });
}

function showConfirmDialog(message, confirmText = "Eliminar", cancelText = "Cancelar") {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-modal">
        <h3>Confirmar accion</h3>
        <p class="muted">${message}</p>
        <div class="confirm-actions">
          <button class="btn-secondary" data-confirm-cancel>${cancelText}</button>
          <button class="btn-danger" data-confirm-ok>${confirmText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const cleanup = (result) => {
      overlay.classList.remove("visible");
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 180);
    };

    overlay.querySelector("[data-confirm-cancel]").addEventListener("click", () => cleanup(false));
    overlay.querySelector("[data-confirm-ok]").addEventListener("click", () => cleanup(true));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) cleanup(false);
    });

    requestAnimationFrame(() => overlay.classList.add("visible"));
  });
}

function renderSidebar() {
  return `
    <nav class="menu">
      ${Object.entries(VIEW_LABELS)
        .map(([view, label]) => `<button class="${currentView === view ? "active" : ""}" data-view="${view}">${label}</button>`)
        .join("")}
    </nav>
  `;
}

function attachCrudActions(selector, onEdit, onDelete) {
  document.querySelectorAll(selector).forEach((button) => {
    button.addEventListener("click", async () => onEdit(button.dataset.id));
  });
  document.querySelectorAll(selector.replace("edit", "delete")).forEach((button) => {
    button.addEventListener("click", async () => onDelete(button.dataset.id));
  });
}

function getFilterValue(key) {
  return (filters[currentView] && filters[currentView][key]) || "";
}

function setFilterValue(key, value) {
  filters[currentView] = { ...(filters[currentView] || {}), [key]: value };
}

function getPage() {
  return (pagination[currentView] && pagination[currentView].page) || 1;
}

function setPage(page) {
  pagination[currentView] = { page: Math.max(1, page) };
}

function getSortField(defaultField = "id") {
  return getFilterValue("sortField") || defaultField;
}

function getSortDirection() {
  return getFilterValue("sortDir") || "desc";
}

function sortItems(items, field, direction) {
  const sorted = [...items];
  sorted.sort((a, b) => {
    const aValue = (a[field] ?? "").toString().toLowerCase();
    const bValue = (b[field] ?? "").toString().toLowerCase();
    if (aValue < bValue) return direction === "asc" ? -1 : 1;
    if (aValue > bValue) return direction === "asc" ? 1 : -1;
    return 0;
  });
  return sorted;
}

function paginate(items, perPage = 5) {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const page = Math.min(getPage(), totalPages);
  setPage(page);
  const start = (page - 1) * perPage;
  return {
    page,
    totalPages,
    items: items.slice(start, start + perPage)
  };
}

function renderFilterBar({ searchPlaceholder, statusOptions = [], sortOptions = [] }) {
  const query = getFilterValue("query");
  const status = getFilterValue("status");
  const sortField = getSortField(sortOptions[0]?.value || "id");
  const sortDir = getSortDirection();
  return `
    <div class="filter-bar">
      <input id="filterQuery" placeholder="${searchPlaceholder}" value="${query}" />
      ${
        statusOptions.length > 0
          ? `
        <select id="filterStatus">
          <option value="">Todos</option>
          ${statusOptions.map((option) => `<option ${status === option ? "selected" : ""}>${option}</option>`).join("")}
        </select>
      `
          : ""
      }
      ${
        sortOptions.length > 0
          ? `
          <select id="filterSortField">
            ${sortOptions
              .map((option) => `<option value="${option.value}" ${sortField === option.value ? "selected" : ""}>Orden: ${option.label}</option>`)
              .join("")}
          </select>
          <select id="filterSortDir">
            <option value="asc" ${sortDir === "asc" ? "selected" : ""}>Asc</option>
            <option value="desc" ${sortDir === "desc" ? "selected" : ""}>Desc</option>
          </select>
        `
          : ""
      }
      <button id="exportCsvBtn">Exportar CSV</button>
      <button id="clearFiltersBtn">Limpiar</button>
    </div>
  `;
}

function renderPager(page, totalPages) {
  return `
    <div class="pager">
      <button ${page <= 1 ? "disabled" : ""} data-page-action="prev">Anterior</button>
      <span class="muted">Pagina ${page} de ${totalPages}</span>
      <button ${page >= totalPages ? "disabled" : ""} data-page-action="next">Siguiente</button>
    </div>
  `;
}

function renderEditPanel(moduleName, id, fields) {
  if (editorState.module !== moduleName || String(editorState.id) !== String(id)) {
    return "";
  }
  return `
    <div class="editor-panel">
      ${fields}
      <div class="actions">
        <button data-save-edit data-module="${moduleName}" data-id="${id}">Guardar cambios</button>
        <button class="btn-secondary" data-cancel-edit>Cancelar</button>
      </div>
    </div>
  `;
}

function csvEscape(value) {
  const raw = value == null ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

function exportRowsToCsv(fileName, rows) {
  if (!rows.length) {
    showToast("No hay datos para exportar.", "warning");
    return;
  }
  const headers = Object.keys(rows[0]);
  const content = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","))
  ].join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast("CSV exportado correctamente.", "success");
}

function renderLogin() {
  appElement.innerHTML = `
    <section class="card" style="max-width: 420px; margin: 80px auto;">
      <h2 class="brand-title">Proelectrica Control Manager</h2>
      <p class="brand-subtitle">Plataforma empresarial de gestion tecnica electrica</p>
      <p class="muted">Inicia sesion para continuar</p>
      <input id="username" placeholder="Usuario" value="admin" />
      <input id="password" type="password" placeholder="Contrasena" value="admin123" />
      <button id="loginBtn">Entrar</button>
      <p id="loginError" class="warn"></p>
    </section>
  `;

  document.getElementById("loginBtn").addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const response = await window.proelectricaApi.login({ username, password });

    if (!response.ok) {
      document.getElementById("loginError").textContent = response.message;
      return;
    }

    currentUser = response.user;
    await showLoginSuccessAlert();
    renderDashboard();
  });
}

async function renderDashboard() {
  const [stats, motors, technicians, maintenances, failures, inventory] = await Promise.all([
    window.proelectricaApi.getDashboardStats(),
    window.proelectricaApi.getMotors(),
    window.proelectricaApi.getTechnicians(),
    window.proelectricaApi.getMaintenances(),
    window.proelectricaApi.getFailures(),
    window.proelectricaApi.getInventoryItems()
  ]);
  const alerts = [
    stats.upcomingMaintenances > 0 ? `Hay ${stats.upcomingMaintenances} mantenimientos programados para los proximos 7 dias.` : null,
    stats.pendingFailures > 0 ? `Existen ${stats.pendingFailures} fallas pendientes por resolver.` : null,
    stats.lowStockItems > 0 ? `${stats.lowStockItems} repuestos estan en stock minimo o por debajo.` : null
  ].filter(Boolean);

  appElement.innerHTML = `
    <div class="dashboard-layout ${isSidebarHidden ? "menu-hidden" : ""}">
      <aside class="card sidebar">
        <button id="menuToggleBtn" class="btn-secondary btn-menu-toggle" title="${isSidebarHidden ? "Mostrar menu" : "Ocultar menu"}">
          ${isSidebarHidden ? "☰" : "Ocultar menu"}
        </button>
        <div class="sidebar-header">
          <h2 class="brand-title">Proelectrica Control Manager</h2>
          <p class="brand-subtitle">Sistema empresarial para operacion y mantenimiento electrico</p>
          <p class="muted">Usuario: ${currentUser.username} (${currentUser.role})</p>
        </div>
        ${renderSidebar()}
        <div class="sidebar-footer">
          <button id="logoutBtn" class="btn-secondary btn-logout">Cerrar sesion</button>
        </div>
      </aside>
      <main class="dashboard-content">

    ${
      currentView === "dashboard"
        ? `
    <section class="card">
      <h3>Dashboard Principal</h3>
      <div class="row-4">
        <article class="card"><strong>${stats.totalMotors}</strong><br/>Motores</article>
        <article class="card"><strong>${stats.totalMaintenances}</strong><br/>Mantenimientos</article>
        <article class="card"><strong>${stats.pendingFailures}</strong><br/>Fallas pendientes</article>
        <article class="card"><strong>${stats.lowStockItems}</strong><br/>Repuestos en minimo</article>
      </div>
      <h3>Alertas automaticas</h3>
      ${
        alerts.length === 0
          ? "<p class='muted'>Sin alertas activas.</p>"
          : `<ul class="alert-list">${alerts.map((alert) => `<li>${alert}</li>`).join("")}</ul>`
      }
    </section>
    `
        : ""
    }

    ${
      currentView === "motores"
        ? `
    <section class="card">
      <h3>Registrar motor</h3>
      <input id="code" placeholder="Codigo interno" />
      <input id="brand" placeholder="Marca" />
      <input id="model" placeholder="Modelo" />
      <input id="location" placeholder="Ubicacion" />
      <select id="status">
        <option>Operativo</option>
        <option>En mantenimiento</option>
        <option>Fuera de servicio</option>
      </select>
      <textarea id="notes" placeholder="Observaciones"></textarea>
      <button id="saveMotorBtn">Guardar motor</button>
    </section>

    <section class="card">
      <h3>Motores</h3>
      ${renderFilterBar({
        searchPlaceholder: "Buscar por codigo, marca o ubicacion",
        statusOptions: ["Operativo", "En mantenimiento", "Fuera de servicio"],
        sortOptions: [
          { value: "code", label: "Codigo" },
          { value: "brand", label: "Marca" },
          { value: "status", label: "Estado" }
        ]
      })}
      ${
        (() => {
          const query = getFilterValue("query").toLowerCase();
          const status = getFilterValue("status");
          const sortField = getSortField("code");
          const sortDir = getSortDirection();
          const filtered = motors.filter((motor) => {
            const haystack = `${motor.code} ${motor.brand} ${motor.model || ""} ${motor.location || ""}`.toLowerCase();
            const statusOk = !status || motor.status === status;
            return (!query || haystack.includes(query)) && statusOk;
          });
          const ordered = sortItems(filtered, sortField, sortDir);
          const { items, page, totalPages } = paginate(ordered);
          if (items.length === 0) return "<p class='muted'>No hay motores para mostrar.</p>";
          return `
            ${items
              .map(
                (motor) => `
            <article class="list-item">
              <strong>${motor.code}</strong> - ${motor.brand} ${motor.model || ""}
              <br/>
              <span class="muted">${motor.location || "Sin ubicacion"} | ${motor.status}</span>
              <div class="actions">
                <button data-edit-motor data-id="${motor.id}">Editar</button>
                <button class="btn-danger" data-delete-motor data-id="${motor.id}">Eliminar</button>
              </div>
              ${renderEditPanel(
                "motor",
                motor.id,
                `
                  <input id="editMotorCode" value="${motor.code}" />
                  <input id="editMotorBrand" value="${motor.brand}" />
                  <input id="editMotorModel" value="${motor.model || ""}" />
                  <input id="editMotorLocation" value="${motor.location || ""}" />
                  <select id="editMotorStatus">
                    ${["Operativo", "En mantenimiento", "Fuera de servicio"]
                      .map((statusOption) => `<option ${motor.status === statusOption ? "selected" : ""}>${statusOption}</option>`)
                      .join("")}
                  </select>
                  <textarea id="editMotorNotes">${motor.notes || ""}</textarea>
                `
              )}
            </article>
          `
              )
              .join("")}
            ${renderPager(page, totalPages)}
          `;
        })()
      }
    </section>
    `
        : ""
    }

    ${
      currentView === "tecnicos"
        ? `
    <section class="card">
      <h3>Registrar tecnico</h3>
      <input id="techName" placeholder="Nombre completo" />
      <input id="techPhone" placeholder="Telefono" />
      <input id="techEmail" placeholder="Correo" />
      <input id="techSpecialty" placeholder="Especialidad" />
      <button id="saveTechnicianBtn">Guardar tecnico</button>
    </section>
    <section class="card">
      <h3>Tecnicos</h3>
      ${renderFilterBar({
        searchPlaceholder: "Buscar por nombre, telefono o especialidad",
        sortOptions: [
          { value: "full_name", label: "Nombre" },
          { value: "specialty", label: "Especialidad" }
        ]
      })}
      ${
        (() => {
          const query = getFilterValue("query").toLowerCase();
          const sortField = getSortField("full_name");
          const sortDir = getSortDirection();
          const filtered = technicians.filter((tech) => {
            const haystack = `${tech.full_name} ${tech.phone || ""} ${tech.specialty || ""}`.toLowerCase();
            return !query || haystack.includes(query);
          });
          const ordered = sortItems(filtered, sortField, sortDir);
          const { items, page, totalPages } = paginate(ordered);
          if (items.length === 0) return "<p class='muted'>No hay tecnicos para mostrar.</p>";
          return `
            ${items
              .map(
                (tech) => `
            <article class="list-item">
              <strong>${tech.full_name}</strong><br/>
              <span class="muted">${tech.phone || "Sin telefono"} | ${tech.specialty || "Sin especialidad"}</span>
              <div class="actions">
                <button data-edit-technician data-id="${tech.id}">Editar</button>
                <button class="btn-danger" data-delete-technician data-id="${tech.id}">Eliminar</button>
              </div>
              ${renderEditPanel(
                "technician",
                tech.id,
                `
                  <input id="editTechName" value="${tech.full_name}" />
                  <input id="editTechPhone" value="${tech.phone || ""}" />
                  <input id="editTechEmail" value="${tech.email || ""}" />
                  <input id="editTechSpecialty" value="${tech.specialty || ""}" />
                `
              )}
            </article>
          `
              )
              .join("")}
            ${renderPager(page, totalPages)}
          `;
        })()
      }
    </section>
    `
        : ""
    }

    ${
      currentView === "mantenimientos"
        ? `
    <section class="card">
      <h3>Registrar mantenimiento</h3>
      <select id="maintenanceMotorId">
        <option value="">Seleccionar motor</option>
        ${motors.map((motor) => `<option value="${motor.id}">${motor.code}</option>`).join("")}
      </select>
      <select id="maintenanceTechnicianId">
        <option value="">Tecnico (opcional)</option>
        ${technicians.map((tech) => `<option value="${tech.id}">${tech.full_name}</option>`).join("")}
      </select>
      <select id="maintenanceType">
        <option>Preventivo</option>
        <option>Correctivo</option>
      </select>
      <input id="maintenanceDate" type="date" />
      <textarea id="maintenanceDescription" placeholder="Descripcion del trabajo"></textarea>
      <input id="maintenanceCost" type="number" placeholder="Costo" />
      <button id="saveMaintenanceBtn">Guardar mantenimiento</button>
    </section>
    <section class="card">
      <h3>Historial de mantenimientos</h3>
      ${renderFilterBar({
        searchPlaceholder: "Buscar por motor o tecnico",
        statusOptions: ["Preventivo", "Correctivo"],
        sortOptions: [
          { value: "maintenance_date", label: "Fecha" },
          { value: "maintenance_type", label: "Tipo" },
          { value: "motor_code", label: "Motor" }
        ]
      })}
      ${
        (() => {
          const query = getFilterValue("query").toLowerCase();
          const status = getFilterValue("status");
          const sortField = getSortField("maintenance_date");
          const sortDir = getSortDirection();
          const filtered = maintenances.filter((item) => {
            const haystack = `${item.motor_code || ""} ${item.technician_name || ""}`.toLowerCase();
            const statusOk = !status || item.maintenance_type === status;
            return (!query || haystack.includes(query)) && statusOk;
          });
          const ordered = sortItems(filtered, sortField, sortDir);
          const { items, page, totalPages } = paginate(ordered);
          if (items.length === 0) return "<p class='muted'>No hay mantenimientos para mostrar.</p>";
          return `
            ${items
              .map(
                (item) => `
            <article class="list-item">
              <strong>${item.maintenance_type}</strong> - Motor: ${item.motor_code}<br/>
              <span class="muted">${item.maintenance_date} | Tecnico: ${item.technician_name || "No asignado"} | Costo: ${item.cost}</span>
              <div class="actions">
                <button data-edit-maintenance data-id="${item.id}">Editar</button>
                <button class="btn-danger" data-delete-maintenance data-id="${item.id}">Eliminar</button>
              </div>
              ${renderEditPanel(
                "maintenance",
                item.id,
                `
                  <select id="editMaintenanceType">
                    ${["Preventivo", "Correctivo"]
                      .map((option) => `<option ${item.maintenance_type === option ? "selected" : ""}>${option}</option>`)
                      .join("")}
                  </select>
                  <input id="editMaintenanceDate" type="date" value="${item.maintenance_date || ""}" />
                  <textarea id="editMaintenanceDescription">${item.description || ""}</textarea>
                  <input id="editMaintenanceCost" type="number" value="${item.cost || 0}" />
                `
              )}
            </article>
          `
              )
              .join("")}
            ${renderPager(page, totalPages)}
          `;
        })()
      }
    </section>
    `
        : ""
    }

    ${
      currentView === "fallas"
        ? `
    <section class="card">
      <h3>Registrar falla</h3>
      <select id="failureMotorId">
        <option value="">Seleccionar motor</option>
        ${motors.map((motor) => `<option value="${motor.id}">${motor.code}</option>`).join("")}
      </select>
      <select id="failureTechnicianId">
        <option value="">Tecnico (opcional)</option>
        ${technicians.map((tech) => `<option value="${tech.id}">${tech.full_name}</option>`).join("")}
      </select>
      <input id="failureType" placeholder="Tipo de falla" />
      <select id="failurePriority">
        <option>Alta</option>
        <option>Media</option>
        <option>Baja</option>
      </select>
      <select id="failureStatus">
        <option>Pendiente</option>
        <option>En proceso</option>
        <option>Resuelta</option>
      </select>
      <input id="failureDate" type="date" />
      <textarea id="failureSolution" placeholder="Solucion aplicada"></textarea>
      <button id="saveFailureBtn">Guardar falla</button>
    </section>
    <section class="card">
      <h3>Fallas</h3>
      ${renderFilterBar({
        searchPlaceholder: "Buscar por tipo de falla o motor",
        statusOptions: ["Pendiente", "En proceso", "Resuelta"],
        sortOptions: [
          { value: "reported_at", label: "Fecha" },
          { value: "priority", label: "Prioridad" },
          { value: "status", label: "Estado" }
        ]
      })}
      ${
        (() => {
          const query = getFilterValue("query").toLowerCase();
          const status = getFilterValue("status");
          const sortField = getSortField("reported_at");
          const sortDir = getSortDirection();
          const filtered = failures.filter((item) => {
            const haystack = `${item.failure_type || ""} ${item.motor_code || ""}`.toLowerCase();
            const statusOk = !status || item.status === status;
            return (!query || haystack.includes(query)) && statusOk;
          });
          const ordered = sortItems(filtered, sortField, sortDir);
          const { items, page, totalPages } = paginate(ordered);
          if (items.length === 0) return "<p class='muted'>No hay fallas para mostrar.</p>";
          return `
            ${items
              .map(
                (item) => `
            <article class="list-item">
              <strong>${item.failure_type}</strong> - Motor: ${item.motor_code}<br/>
              <span class="muted">${item.priority} | ${item.status} | Tecnico: ${item.technician_name || "No asignado"}</span>
              <div class="actions">
                <button data-edit-failure data-id="${item.id}">Editar</button>
                <button class="btn-danger" data-delete-failure data-id="${item.id}">Eliminar</button>
              </div>
              ${renderEditPanel(
                "failure",
                item.id,
                `
                  <input id="editFailureType" value="${item.failure_type || ""}" />
                  <select id="editFailurePriority">
                    ${["Alta", "Media", "Baja"].map((option) => `<option ${item.priority === option ? "selected" : ""}>${option}</option>`).join("")}
                  </select>
                  <select id="editFailureStatus">
                    ${["Pendiente", "En proceso", "Resuelta"].map((option) => `<option ${item.status === option ? "selected" : ""}>${option}</option>`).join("")}
                  </select>
                  <input id="editFailureDate" type="date" value="${item.reported_at || ""}" />
                  <textarea id="editFailureSolution">${item.solution || ""}</textarea>
                `
              )}
            </article>
          `
              )
              .join("")}
            ${renderPager(page, totalPages)}
          `;
        })()
      }
    </section>
    `
        : ""
    }

    ${
      currentView === "inventario"
        ? `
    <section class="card">
      <h3>Registrar repuesto</h3>
      <input id="partName" placeholder="Nombre del repuesto" />
      <input id="partSku" placeholder="SKU/Codigo" />
      <input id="partQty" type="number" placeholder="Cantidad" />
      <input id="partMin" type="number" placeholder="Stock minimo" />
      <input id="partLocation" placeholder="Ubicacion" />
      <button id="saveInventoryBtn">Guardar repuesto</button>
    </section>
    <section class="card">
      <h3>Inventario</h3>
      ${renderFilterBar({
        searchPlaceholder: "Buscar por repuesto, codigo o ubicacion",
        sortOptions: [
          { value: "part_name", label: "Repuesto" },
          { value: "quantity", label: "Cantidad" },
          { value: "min_stock", label: "Stock minimo" }
        ]
      })}
      ${
        (() => {
          const query = getFilterValue("query").toLowerCase();
          const sortField = getSortField("part_name");
          const sortDir = getSortDirection();
          const filtered = inventory.filter((item) => {
            const haystack = `${item.part_name || ""} ${item.sku || ""} ${item.location || ""}`.toLowerCase();
            return !query || haystack.includes(query);
          });
          const ordered = sortItems(filtered, sortField, sortDir);
          const { items, page, totalPages } = paginate(ordered);
          if (items.length === 0) return "<p class='muted'>No hay repuestos para mostrar.</p>";
          return `
            ${items
              .map(
                (item) => `
            <article class="list-item">
              <strong>${item.part_name}</strong> (${item.sku || "N/A"})<br/>
              <span class="muted">Cantidad: ${item.quantity} | Minimo: ${item.min_stock} | ${item.location || "Sin ubicacion"}</span>
              <div class="actions">
                <button data-edit-inventory data-id="${item.id}">Editar</button>
                <button class="btn-danger" data-delete-inventory data-id="${item.id}">Eliminar</button>
              </div>
              ${renderEditPanel(
                "inventory",
                item.id,
                `
                  <input id="editInventoryName" value="${item.part_name}" />
                  <input id="editInventorySku" value="${item.sku || ""}" />
                  <input id="editInventoryQty" type="number" value="${item.quantity || 0}" />
                  <input id="editInventoryMin" type="number" value="${item.min_stock || 0}" />
                  <input id="editInventoryLocation" value="${item.location || ""}" />
                `
              )}
            </article>
          `
              )
              .join("")}
            ${renderPager(page, totalPages)}
          `;
        })()
      }
    </section>
    `
        : ""
    }
      </main>
    </div>
  `;

  appElement.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      currentView = button.dataset.view;
      editorState = { module: null, id: null };
      setPage(1);
      renderDashboard();
    });
  });

  const menuToggleBtn = document.getElementById("menuToggleBtn");
  if (menuToggleBtn) {
    menuToggleBtn.addEventListener("click", () => {
      isSidebarHidden = !isSidebarHidden;
      persistSidebarState();
      renderDashboard();
    });
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      currentUser = null;
      currentView = "dashboard";
      filters = {};
      pagination = {};
      editorState = { module: null, id: null };
      showToast("Sesion cerrada correctamente.", "success");
      renderLogin();
    });
  }

  const filterQuery = document.getElementById("filterQuery");
  if (filterQuery) {
    filterQuery.addEventListener("input", (event) => {
      setFilterValue("query", event.target.value);
      setPage(1);
      renderDashboard();
    });
  }

  const filterStatus = document.getElementById("filterStatus");
  if (filterStatus) {
    filterStatus.addEventListener("change", (event) => {
      setFilterValue("status", event.target.value);
      setPage(1);
      renderDashboard();
    });
  }

  const filterSortField = document.getElementById("filterSortField");
  if (filterSortField) {
    filterSortField.addEventListener("change", (event) => {
      setFilterValue("sortField", event.target.value);
      setPage(1);
      renderDashboard();
    });
  }

  const filterSortDir = document.getElementById("filterSortDir");
  if (filterSortDir) {
    filterSortDir.addEventListener("change", (event) => {
      setFilterValue("sortDir", event.target.value);
      setPage(1);
      renderDashboard();
    });
  }

  const exportCsvBtn = document.getElementById("exportCsvBtn");
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", () => {
      if (currentView === "motores") {
        exportRowsToCsv("motores.csv", motors);
      } else if (currentView === "tecnicos") {
        exportRowsToCsv("tecnicos.csv", technicians);
      } else if (currentView === "mantenimientos") {
        exportRowsToCsv("mantenimientos.csv", maintenances);
      } else if (currentView === "fallas") {
        exportRowsToCsv("fallas.csv", failures);
      } else if (currentView === "inventario") {
        exportRowsToCsv("inventario.csv", inventory);
      } else {
        showToast("No hay modulo exportable en esta vista.", "warning");
      }
    });
  }

  const clearFiltersBtn = document.getElementById("clearFiltersBtn");
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      filters[currentView] = {};
      setPage(1);
      renderDashboard();
    });
  }

  document.querySelectorAll("[data-page-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.pageAction === "prev") setPage(getPage() - 1);
      if (button.dataset.pageAction === "next") setPage(getPage() + 1);
      renderDashboard();
    });
  });

  const saveMotorBtn = document.getElementById("saveMotorBtn");
  if (saveMotorBtn) {
    saveMotorBtn.addEventListener("click", async () => {
      const payload = {
        code: document.getElementById("code").value.trim(),
        brand: document.getElementById("brand").value.trim(),
        model: document.getElementById("model").value.trim(),
        location: document.getElementById("location").value.trim(),
        status: document.getElementById("status").value,
        notes: document.getElementById("notes").value.trim()
      };

      if (!payload.code || !payload.brand) {
        showValidation("Motor: codigo y marca son obligatorios.");
        return;
      }

      await window.proelectricaApi.createMotor(payload);
      showToast("Motor registrado.");
      renderDashboard();
    });
  }

  const saveTechnicianBtn = document.getElementById("saveTechnicianBtn");
  if (saveTechnicianBtn) {
    saveTechnicianBtn.addEventListener("click", async () => {
      const payload = {
        fullName: document.getElementById("techName").value.trim(),
        phone: document.getElementById("techPhone").value.trim(),
        email: document.getElementById("techEmail").value.trim(),
        specialty: document.getElementById("techSpecialty").value.trim()
      };
      if (!payload.fullName) {
        showValidation("Tecnico: nombre completo es obligatorio.");
        return;
      }
      await window.proelectricaApi.createTechnician(payload);
      showToast("Tecnico registrado.");
      renderDashboard();
    });
  }

  const saveMaintenanceBtn = document.getElementById("saveMaintenanceBtn");
  if (saveMaintenanceBtn) {
    saveMaintenanceBtn.addEventListener("click", async () => {
      const payload = {
        motorId: document.getElementById("maintenanceMotorId").value,
        technicianId: document.getElementById("maintenanceTechnicianId").value,
        maintenanceType: document.getElementById("maintenanceType").value,
        maintenanceDate: document.getElementById("maintenanceDate").value,
        description: document.getElementById("maintenanceDescription").value.trim(),
        cost: document.getElementById("maintenanceCost").value
      };
      if (!payload.motorId || !payload.maintenanceDate) {
        showValidation("Mantenimiento: motor y fecha son obligatorios.");
        return;
      }
      await window.proelectricaApi.createMaintenance(payload);
      showToast("Mantenimiento registrado.");
      renderDashboard();
    });
  }

  const saveFailureBtn = document.getElementById("saveFailureBtn");
  if (saveFailureBtn) {
    saveFailureBtn.addEventListener("click", async () => {
      const payload = {
        motorId: document.getElementById("failureMotorId").value,
        technicianId: document.getElementById("failureTechnicianId").value,
        failureType: document.getElementById("failureType").value.trim(),
        priority: document.getElementById("failurePriority").value,
        status: document.getElementById("failureStatus").value,
        reportedAt: document.getElementById("failureDate").value,
        solution: document.getElementById("failureSolution").value.trim()
      };
      if (!payload.motorId || !payload.failureType || !payload.reportedAt) {
        showValidation("Falla: motor, tipo y fecha son obligatorios.");
        return;
      }
      await window.proelectricaApi.createFailure(payload);
      showToast("Falla registrada.");
      renderDashboard();
    });
  }

  const saveInventoryBtn = document.getElementById("saveInventoryBtn");
  if (saveInventoryBtn) {
    saveInventoryBtn.addEventListener("click", async () => {
      const payload = {
        partName: document.getElementById("partName").value.trim(),
        sku: document.getElementById("partSku").value.trim(),
        quantity: document.getElementById("partQty").value,
        minStock: document.getElementById("partMin").value,
        location: document.getElementById("partLocation").value.trim()
      };
      if (!payload.partName) {
        showValidation("Inventario: nombre del repuesto es obligatorio.");
        return;
      }
      await window.proelectricaApi.createInventoryItem(payload);
      showToast("Repuesto registrado.");
      renderDashboard();
    });
  }

  attachCrudActions(
    "[data-edit-motor]",
    async (id) => {
      editorState = { module: "motor", id };
      renderDashboard();
    },
    async (id) => {
      const confirmed = await showConfirmDialog("Se eliminara este motor de forma permanente.");
      if (!confirmed) return;
      await window.proelectricaApi.deleteMotor(id);
      showToast("Motor eliminado.", "success");
      renderDashboard();
    }
  );

  attachCrudActions(
    "[data-edit-technician]",
    async (id) => {
      editorState = { module: "technician", id };
      renderDashboard();
    },
    async (id) => {
      const confirmed = await showConfirmDialog("Se eliminara este tecnico de forma permanente.");
      if (!confirmed) return;
      await window.proelectricaApi.deleteTechnician(id);
      showToast("Tecnico eliminado.", "success");
      renderDashboard();
    }
  );

  attachCrudActions(
    "[data-edit-maintenance]",
    async (id) => {
      editorState = { module: "maintenance", id };
      renderDashboard();
    },
    async (id) => {
      const confirmed = await showConfirmDialog("Se eliminara este mantenimiento de forma permanente.");
      if (!confirmed) return;
      await window.proelectricaApi.deleteMaintenance(id);
      showToast("Mantenimiento eliminado.", "success");
      renderDashboard();
    }
  );

  attachCrudActions(
    "[data-edit-failure]",
    async (id) => {
      editorState = { module: "failure", id };
      renderDashboard();
    },
    async (id) => {
      const confirmed = await showConfirmDialog("Se eliminara esta falla de forma permanente.");
      if (!confirmed) return;
      await window.proelectricaApi.deleteFailure(id);
      showToast("Falla eliminada.", "success");
      renderDashboard();
    }
  );

  attachCrudActions(
    "[data-edit-inventory]",
    async (id) => {
      editorState = { module: "inventory", id };
      renderDashboard();
    },
    async (id) => {
      const confirmed = await showConfirmDialog("Se eliminara este repuesto de forma permanente.");
      if (!confirmed) return;
      await window.proelectricaApi.deleteInventoryItem(id);
      showToast("Repuesto eliminado.", "success");
      renderDashboard();
    }
  );

  const cancelEditBtn = document.querySelector("[data-cancel-edit]");
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", () => {
      editorState = { module: null, id: null };
      renderDashboard();
    });
  }

  const saveEditBtn = document.querySelector("[data-save-edit]");
  if (saveEditBtn) {
    saveEditBtn.addEventListener("click", async () => {
      const moduleName = saveEditBtn.dataset.module;
      const id = saveEditBtn.dataset.id;

      if (moduleName === "motor") {
        await window.proelectricaApi.updateMotor({
          id,
          code: document.getElementById("editMotorCode").value.trim(),
          brand: document.getElementById("editMotorBrand").value.trim(),
          model: document.getElementById("editMotorModel").value.trim(),
          location: document.getElementById("editMotorLocation").value.trim(),
          status: document.getElementById("editMotorStatus").value,
          notes: document.getElementById("editMotorNotes").value.trim()
        });
      }
      if (moduleName === "technician") {
        await window.proelectricaApi.updateTechnician({
          id,
          fullName: document.getElementById("editTechName").value.trim(),
          phone: document.getElementById("editTechPhone").value.trim(),
          email: document.getElementById("editTechEmail").value.trim(),
          specialty: document.getElementById("editTechSpecialty").value.trim()
        });
      }
      if (moduleName === "maintenance") {
        const target = maintenances.find((item) => String(item.id) === String(id));
        await window.proelectricaApi.updateMaintenance({
          id,
          motorId: motors.find((m) => m.code === target.motor_code)?.id || "",
          technicianId: technicians.find((t) => t.full_name === target.technician_name)?.id || "",
          maintenanceType: document.getElementById("editMaintenanceType").value,
          maintenanceDate: document.getElementById("editMaintenanceDate").value,
          description: document.getElementById("editMaintenanceDescription").value.trim(),
          cost: document.getElementById("editMaintenanceCost").value
        });
      }
      if (moduleName === "failure") {
        const target = failures.find((item) => String(item.id) === String(id));
        await window.proelectricaApi.updateFailure({
          id,
          motorId: motors.find((m) => m.code === target.motor_code)?.id || "",
          technicianId: technicians.find((t) => t.full_name === target.technician_name)?.id || "",
          failureType: document.getElementById("editFailureType").value.trim(),
          priority: document.getElementById("editFailurePriority").value,
          status: document.getElementById("editFailureStatus").value,
          reportedAt: document.getElementById("editFailureDate").value,
          solution: document.getElementById("editFailureSolution").value.trim()
        });
      }
      if (moduleName === "inventory") {
        await window.proelectricaApi.updateInventoryItem({
          id,
          partName: document.getElementById("editInventoryName").value.trim(),
          sku: document.getElementById("editInventorySku").value.trim(),
          quantity: document.getElementById("editInventoryQty").value,
          minStock: document.getElementById("editInventoryMin").value,
          location: document.getElementById("editInventoryLocation").value.trim()
        });
      }

      editorState = { module: null, id: null };
      showToast("Registro actualizado.", "success");
      renderDashboard();
    });
  }
}

renderLogin();
