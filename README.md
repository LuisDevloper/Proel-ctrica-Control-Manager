# Proélectrica Control Manager

Aplicación de escritorio para gestión de motores eléctricos, turbinas, mantenimientos, fallas, técnicos, inventario y logística de taller externo. Construida con **Electron** + **React** + **Tailwind CSS** y base de datos en la nube **PostgreSQL (Neon)**.

---

## Stack técnico

| Capa | Tecnología |
|------|------------|
| Shell | Electron 34 |
| Frontend | React 19 + Vite 8 |
| Estilos | Tailwind CSS v4 + variables CSS |
| UI | Lucide React, Recharts |
| Base de datos | PostgreSQL en Neon (`pg`) — multi-PC, en la nube |
| Excel | ExcelJS (plantillas, importación y exportación `.xlsx`) |
| PDF | jsPDF + jspdf-autotable |
| Estado de ventana | electron-store |
| Actualizaciones | electron-updater (GitHub Releases) |
| Servicios | Logger local (errores y auditoría) |

---

## Inicio rápido

```bash
npm install
```

Antes de iniciar el proyecto en desarrollo, necesitas el archivo `src/database/config.js` con la cadena de conexión a Neon (no está en Git):

```js
// src/database/config.js  ← NO subir a Git
module.exports = {
  DATABASE_URL: "postgresql://usuario:clave@host/neondb?sslmode=require",
};
```

Luego:

```bash
npm run dev
```

En desarrollo, **Vite** sirve el renderer en `http://localhost:5173` y **Electron** espera a que esté listo antes de abrir. Si cambias código del **proceso principal** (`src/main/`), cierra Electron y vuelve a ejecutar `npm run dev` para que carguen los handlers IPC actualizados.

### Compilar e instalar

```bash
npm run build
```

Recompila `better-sqlite3` para Electron, genera el icono, compila React a `renderer-dist/` y empaqueta el instalador NSIS (Windows x64) en `dist/`. El `DATABASE_URL` queda embebido en el instalador.

---

## Credenciales iniciales (primera instalación)

Al conectarse a una base de datos vacía, se crea automáticamente un administrador por defecto:

| Campo | Valor |
|-------|--------|
| Usuario | `Proelectrica` |
| Contraseña | `Pro.2026` |

**Importante:** cambia la contraseña en **Configuración → Cambiar contraseña** antes de entregar el equipo.

---

## Roles de usuario

| Rol | Permisos |
|-----|----------|
| **ADMIN** | Acceso total; gestión de usuarios y registro de actividad |
| **OPERADOR** | Alta, edición y borrado de datos operativos |
| **VISOR** | Solo consulta y exportación; no modifica registros |

---

## Arquitectura multi-PC

Todos los datos se guardan en **Neon (PostgreSQL en la nube)**. Cualquier PC con la app instalada accede a los mismos datos en tiempo real. No hay base de datos local.

**Migración automática desde versiones anteriores:** si un PC tenía datos en SQLite (versión ≤ 1.4.x), la primera vez que abra la nueva versión los datos se migran automáticamente a Neon sin intervención del usuario.

---

## Estructura del proyecto

```
src/
├── main/
│   ├── main.js      → Ventana, auto-updater, ciclo de vida, migración automática
│   ├── ipc/         → Handlers IPC por dominio (auth, motors, maintenances…)
│   └── preload.js   → API expuesta al renderer (proelectricaApi)
├── database/
│   ├── db.js        → PostgreSQL: esquema, tablas, usuario inicial
│   ├── pgAdapter.js → Adaptador async compatible con API de better-sqlite3
│   └── autoMigrate.js → Migración única SQLite local → Neon (se ejecuta sola)
├── services/
│   ├── logger.js    → Logs en userData/logs/
│   ├── backup.js    → No aplica con Neon (copias las gestiona Neon)
│   └── documents.js → Documentos adjuntos en userData/storage/
├── modules/         → Lógica de dominio (equipos, inventario, envíos, dashboard)
└── renderer-react/  → UI React (build → renderer-dist/)
    ├── App.jsx
    ├── components/  → layout (Sidebar, FilterBar…), ui (Toast, Modal…)
    ├── views/       → Login, Dashboard, Motores, Fallas, Configuracion…
    ├── context/     → Tema, accesibilidad, salud de BD
    ├── hooks/       → useFilters, useAsync, useInlineEdit
    └── lib/         → pdfReport, excelExport, permissions
```

---

## Funcionalidad principal

### Core
- Sesión con roles (ADMIN / OPERADOR / VISOR)
- Sidebar con indicador de conexión a la base de datos
- Tema claro / oscuro; tamaño de texto accesible (atajos Alt + + / − / 0)
- Banner y recordatorio de actualizaciones OTA

### Dashboard
- KPIs y gráficas por año/mes (Recharts)
- Campana de notificaciones: mantenimientos próximos, fallas pendientes, stock bajo

### Módulos operativos
- **Motores:** CRUD, foto, detalle con historial; exportación PDF y Excel; importación Excel
- **Turbinas:** CRUD, vinculación con motor
- **Taller externo:** logística de envíos a talleres, seguimiento de estado
- **Mantenimientos** y **Fallas:** CRUD; export PDF/Excel; calendario mensual
- **Técnicos:** CRUD; import/export Excel
- **Inventario:** stock, mínimos, movimientos; export Excel
- **Documentos:** adjuntos PDF/imágenes por entidad
- **Usuarios** y **Actividad** (solo **ADMIN**)

### Configuración
- Información del sistema: versión, SO, modo de instalación
- Comprobación manual de actualizaciones
- Historial de versiones en la app
- Cambio de contraseña del usuario en sesión
- Accesibilidad: tamaño de texto

---

## Importación y exportación Excel

- Las plantillas se generan desde el modal de importación en **Motores** y **Técnicos**
- Las fechas se normalizan al pasar de Excel a la app y al exportar, para evitar desfases por zona horaria
- Tras importar, la app avisa si hubo filas omitidas (ej. códigos duplicados)

---

## Actualizaciones automáticas (GitHub)

`electron-updater` usa el release de GitHub configurado en `package.json` (`build.publish`). Flujo habitual:

1. Sube la versión en `package.json`
2. Genera artefactos y publícalos con un token con permisos sobre el repo:

```bash
# Windows (PowerShell)
$env:GH_TOKEN="tu_personal_access_token"
npm run release:github
```

Equivale a compilar el renderer y ejecutar `electron-builder --publish always`. En cada release deben figurar el **instalador** y el **`latest.yml`** (lo genera electron-builder en `dist/`).

Los usuarios con la app empaquetada reciben la comprobación ~5 s tras arranque, comprobación periódica, y botón **Buscar actualizaciones** en Configuración.

---

## Scripts npm

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Vite + Electron en paralelo (espera a que Vite esté listo) |
| `npm run build` | Recompila módulos nativos + build React + instalador `.exe` |
| `npm run release:github` | Igual que build + `--publish always` (requiere `GH_TOKEN`) |
| `npm run rebuild:native` | Recompila `better-sqlite3` para Electron si hace falta |
| `npm run db:init` | Inicializa tablas en Neon (solo al crear la BD desde cero) |
| `npm run build:renderer` | Solo compila el frontend |
| `npm run build:icon` | Regenera `build/icon.ico` |
| `npm start` | Solo Electron (requiere `renderer-dist/` ya compilado) |
| `npm test` | Corre tests unitarios con `node --test` |

---

## Datos locales (por PC)

| Contenido | Ubicación |
|-----------|-----------|
| Documentos adjuntos | `userData/storage/` |
| Logs de la app | `userData/logs/` |
| Estado de ventana | `userData/window-state.json` |

> **Nota:** La base de datos ya no es local. Los datos de negocio (motores, mantenimientos, etc.) están en Neon y son compartidos entre todos los PCs con la app instalada.

---

## Licencia

MIT (ver `package.json`).
