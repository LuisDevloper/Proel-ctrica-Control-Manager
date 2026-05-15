# Proélectrica Control Manager

Aplicación de escritorio para gestión de motores eléctricos, mantenimientos, fallas, técnicos e inventario industrial. Construida con **Electron** + **React** + **Tailwind CSS** y **SQLite** local.

---

## Stack técnico

| Capa | Tecnología |
|------|------------|
| Shell | Electron 34 |
| Frontend | React 19 + Vite 8 |
| Estilos | Tailwind CSS v4 + variables CSS |
| UI | Lucide React, Recharts |
| Base de datos | SQLite (`better-sqlite3`) |
| Excel | ExcelJS (plantillas, importación y exportación `.xlsx`) |
| PDF | jsPDF + jspdf-autotable |
| Estado de ventana | electron-store |
| Actualizaciones | electron-updater (GitHub Releases) |
| Servicios | Logger local, copias de seguridad programadas |

---

## Inicio rápido

```bash
npm install
npm run dev
```

En desarrollo, **Vite** sirve el renderer en `http://localhost:5173` y **Electron** abre esa URL. Si cambias código del **proceso principal** (`src/main/`), cierra Electron y vuelve a ejecutar `npm run dev` para que carguen los handlers IPC actualizados.

### Compilar e instalar

```bash
npm run build
```

Genera el icono, compila React a `renderer-dist/` y empaqueta el instalador NSIS (Windows x64) en `dist/`.

---

## Credenciales iniciales (primera instalación)

Tras crear la base de datos vacía, se crea un único administrador:

| Campo | Valor |
|-------|--------|
| Usuario | `Proelectrica` |
| Contraseña | `Pro.2026` |

**Importante:** cambia la contraseña en **Configuración** antes de entregar el equipo al cliente. Las bases ya existentes no se sobrescriben; hubo migración desde el usuario antiguo `admin`.

---

## Roles de usuario

| Rol | Uso |
|-----|-----|
| **ADMIN** | Acceso total; gestión de usuarios y registro de actividad |
| **OPERADOR** | Alta, edición y borrado de datos operativos |
| **VISOR** | Solo consulta y exportación; no modifica registros |

---

## Estructura del proyecto

```
src/
├── main/
│   ├── main.js      → Ventana, auto-updater, ciclo de vida
│   ├── ipc.js       → Handlers IPC (CRUD, import Excel, permisos, backup…)
│   └── preload.js   → API expuesta al renderer (`proelectricaApi`)
├── database/
│   └── db.js        → SQLite: esquema, migraciones, usuario inicial
├── services/
│   ├── logger.js    → Logs en userData/logs
│   └── backup.js    → Copias automáticas en userData/backups
├── renderer-react/  → UI React (build → renderer-dist/)
│   ├── App.jsx
│   ├── components/  → layout (Sidebar, FilterBar…), ui (Toast, ImportModal…)
│   ├── views/       → Login, Dashboard, Motores, Fallas, Configuracion…
│   ├── context/     → Tema, accesibilidad, salud de BD
│   ├── hooks/       → useFilters, useAsync
│   └── lib/         → pdfReport, excelExport, permissions
└── modules/         → Reservado para lógica por dominio (ver src/modules/README.md)
```

---

## Funcionalidad principal

### Core
- Sesión con roles; cierre de sesión con confirmación
- Sidebar con estado de conexión a la base de datos
- Tema claro / oscuro; tamaño de texto accesible (atajos Alt + + / − / 0)
- Banner y recordatorio de actualizaciones OTA

### Dashboard
- KPIs y gráficas (Recharts)
- Campana de notificaciones (mantenimientos próximos, fallas pendientes, stock bajo)

### Módulos operativos
- **Motores:** CRUD, foto, detalle con historial; exportación PDF y Excel; **importación Excel** (plantilla desde la app)
- **Mantenimientos** y **Fallas:** CRUD; export PDF/Excel; fechas en formularios
- **Técnicos:** CRUD; import/export Excel
- **Inventario:** stock y mínimos; export Excel
- **Calendario:** vista mensual de mantenimientos
- **Usuarios** y **Actividad** (solo **ADMIN**)

### Configuración
- Información del sistema orientada al cliente: producto, versión, sistema operativo, tipo de instalación, **ruta de datos** (`userData`)
- Comprobación manual de actualizaciones (solo aplica en app **instalada**; en `npm run dev` el comprobador OTA no está activo igual que en producción)
- Backup y restauración manual de la base
- Cambio de contraseña del usuario en sesión

---

## Importación y exportación Excel

- Las plantillas se generan desde el modal de importación en **Motores** y **Técnicos**
- Las fechas se normalizan al pasar de Excel a la app y al exportar, para evitar desfases por zona horaria
- Tras importar, la app avisa si hubo filas omitidas (p. ej. códigos duplicados)

---

## Actualizaciones automáticas (GitHub)

`electron-updater` usa el release de GitHub configurado en `package.json` (`build.publish`). Flujo habitual:

1. Sube la versión en `package.json`
2. Genera artefactos y publícalos con token con permisos sobre el repo:

```bash
# Windows (PowerShell): definir GH_TOKEN y publicar
$env:GH_TOKEN="tu_personal_access_token"
npm run release:github
```

Eso equivale a compilar el renderer y ejecutar `electron-builder --publish always`. En cada release deben figurar el **instalador** y el **`latest.yml`** (lo genera electron-builder en `dist/`).

Los usuarios con la app empaquetada: comprobación ~5 s tras arranque, comprobación periódica y botón **Buscar actualizaciones** en Configuración.

---

## Rutas y datos locales

| Contenido | Ubicación típica |
|-----------|------------------|
| Base de datos | `userData/proelectrica.db` |
| Copias automáticas | `userData/backups/` (retención acotada) |
| Logs | `userData/logs/` |

`userData` depende del SO (en Windows, carpeta de datos de la aplicación del usuario).

---

## Scripts npm

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Vite + Electron en paralelo |
| `npm run build` | Icono + build React + instalador `.exe` |
| `npm run release:github` | Igual que build + `--publish always` (requiere `GH_TOKEN`) |
| `npm run build:renderer` | Solo compila el frontend |
| `npm run build:icon` | Regenera `build/icon.ico` |
| `npm run rebuild:native` | Recompila `better-sqlite3` para Electron si hace falta |
| `npm start` | Solo Electron (requiere `renderer-dist/` ya compilado) |

---

## Licencia

MIT (ver `package.json`).
