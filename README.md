# Proelectrica Control Manager

Aplicacion de escritorio para gestion de motores electricos, mantenimientos e inventario industrial. Construida con Electron + React + Tailwind CSS + SQLite local.

---

## Stack tecnico

| Capa | Tecnologia |
|---|---|
| Shell | Electron 34 |
| Frontend | React 19 + Vite 8 |
| Estilos | Tailwind CSS v4 + CSS variables |
| UI Components | Lucide React, Recharts |
| Base de datos | SQLite via `better-sqlite3` |
| PDF / Exportacion | jsPDF + jspdf-autotable |
| Estado de ventana | electron-store |
| Actualizaciones | electron-updater (GitHub Releases) |
| Servicios | Logger local, Backup automatico |

---

## Inicio rapido

```bash
# 1. Instalar dependencias
npm install

# 2. Desarrollo (Vite + Electron en paralelo)
npm run dev

# 3. Generar instalador (.exe)
npm run build
```

**Credenciales iniciales:**
- Usuario: `admin`
- Contrasena: `admin123`

---

## Estructura del proyecto

```
src/
├── main/           → Proceso principal de Electron
│   ├── main.js     → BrowserWindow, auto-updater, ciclo de vida
│   ├── ipc.js      → Todos los handlers IPC (CRUD, stats, notificaciones)
│   └── preload.js  → Puente seguro renderer ↔ main
├── database/
│   └── db.js       → Inicializacion SQLite, esquema y seed
├── services/
│   ├── logger.js   → Logs locales en userData/logs
│   └── backup.js   → Backup diario automatico en userData/backups
└── renderer-react/ → Frontend React (compilado a renderer-dist/)
    ├── App.jsx
    ├── main.jsx
    ├── index.css
    ├── context/
    │   └── ThemeContext.jsx   → Modo claro / oscuro
    ├── components/
    │   ├── layout/
    │   │   ├── Sidebar.jsx    → Menu lateral colapsable + toggle tema
    │   │   ├── FilterBar.jsx  → Busqueda, ordenamiento y exportacion
    │   │   └── Pager.jsx      → Paginacion
    │   └── ui/
    │       ├── NotificationBell.jsx  → Campanita con alertas en tiempo real
    │       ├── UpdateBanner.jsx      → Banner de actualizacion automatica
    │       ├── SplashScreen.jsx      → Pantalla de carga animada
    │       ├── AppLogo.jsx           → Logo de la app
    │       ├── Toast.jsx             → Notificaciones tipo toast
    │       ├── Modal.jsx             → Modal de confirmacion
    │       ├── Skeleton.jsx          → Skeletons de carga
    │       ├── CurrencyInput.jsx     → Input con formato de moneda
    │       └── ...
    ├── views/
    │   ├── Login.jsx
    │   ├── Dashboard.jsx
    │   ├── Motores.jsx
    │   ├── Mantenimientos.jsx
    │   ├── Fallas.jsx
    │   ├── Tecnicos.jsx
    │   ├── Inventario.jsx
    │   ├── Calendario.jsx
    │   ├── MotorDetail.jsx
    │   └── Configuracion.jsx
    ├── hooks/
    │   ├── useAsync.js    → Wrapper para llamadas async con manejo de errores
    │   └── useFilters.js  → Filtros, ordenamiento y paginacion
    └── lib/
        ├── utils.js       → Funcion cn() para clases Tailwind
        └── pdfReport.js   → Generacion de reportes PDF
```

---

## Modulos implementados

### Core
- Inicio de sesion con roles (admin / operador)
- Pantalla splash animada al inicio
- Sidebar colapsable con indicador de estado de BD
- Modo claro / oscuro con persistencia en localStorage

### Dashboard
- KPIs en tiempo real: motores, mantenimientos, fallas pendientes, stock minimo
- Graficas con Recharts: estado de motores (pie), mantenimientos por mes (barras), fallas en el tiempo (area)
- Skeletons de carga

### Campanita de Notificaciones
- Icono en la esquina superior derecha
- Alertas agrupadas por tipo:
  - Mantenimientos proximos (proximos 7 dias)
  - Fallas pendientes sin resolver
  - Items de inventario con stock en minimo
- Se actualiza automaticamente cada 30 segundos

### Motores
- CRUD completo con filtros, ordenamiento y paginacion
- Vista de detalle por motor con historial de mantenimientos y fallas
- Exportacion CSV y PDF por motor

### Mantenimientos
- CRUD completo
- Input de costo con formato de moneda automatico
- Exportacion CSV y PDF

### Fallas
- CRUD completo con prioridad y estado
- Exportacion CSV y PDF

### Tecnicos
- CRUD completo con filtros

### Inventario
- CRUD completo con control de stock minimo
- Alerta visual cuando el stock llega al minimo

### Calendario
- Vista mensual de mantenimientos programados
- Modal de detalle al hacer clic en un evento

### Configuracion
- Informacion de la app (version, Electron, Node.js, plataforma)
- Verificacion de conexion a la base de datos
- Cambio de contrasena del usuario activo

---

## Actualizaciones automaticas

La app usa `electron-updater` con GitHub Releases como servidor.

### Para publicar una nueva version:

```bash
# 1. Subir version en package.json (ej: 0.1.0 → 0.2.0)

# 2. Generar y publicar
GH_TOKEN=tu_token npm run build -- --publish always
```

El usuario final recibe la actualizacion automaticamente:
1. La app verifica al iniciar (5 seg despues del arranque)
2. Si hay nueva version, descarga en segundo plano
3. Aparece un banner con barra de progreso
4. Al terminar puede instalar con un clic o esperar al cierre

---

## Notas tecnicas

- La base de datos SQLite se guarda en `userData/proelectrica.db` (no en el directorio de instalacion).
- Los backups automaticos se guardan en `userData/backups` con retencion de las ultimas copias.
- Los logs se guardan en `userData/logs`.
- El estado de la ventana (tamano, posicion, maximizado) se persiste entre sesiones.
- El icono `.ico` se genera automaticamente con `scripts/make-icon.mjs` usando `jimp`.
- En modo desarrollo Vite corre en `localhost:5173`; en produccion se carga desde `renderer-dist/`.

---

## Scripts disponibles

| Script | Descripcion |
|---|---|
| `npm run dev` | Inicia Vite + Electron en paralelo (modo desarrollo) |
| `npm run build` | Genera icono, compila React y crea instalador `.exe` |
| `npm run build:renderer` | Solo compila el frontend React |
| `npm run build:icon` | Solo regenera el icono `.ico` |
| `npm start` | Inicia Electron sin Vite (requiere `renderer-dist/` compilado) |
