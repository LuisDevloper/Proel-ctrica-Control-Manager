# Proelectrica Control Manager

Aplicacion de escritorio para gestion de motores electricos y mantenimientos industriales.

## Stack actual

- Electron
- Node.js
- SQLite local en archivo `proelectrica.db`
- `better-sqlite3` (preferido) con fallback automatico a `sql.js` si el entorno no permite binarios nativos
- HTML/CSS/JavaScript

## Primer inicio

1. Instalar dependencias:
   - `npm install`
2. Ejecutar en modo desarrollo:
   - `npm run dev`

Credenciales iniciales:

- Usuario: `admin`
- Contrasena: `admin123`

## Estructura

- `src/main`: proceso principal de Electron e IPC
- `src/database`: inicializacion y persistencia de base de datos
- `src/renderer`: interfaz de usuario
- `src/services`: servicios transversales (logs, backups)
- `src/modules`: base para modularizar logica de negocio
- `src/utils`: utilidades comunes

## Modulos ya implementados

- Inicio de sesion basico con roles
- Dashboard con indicadores operativos
- Registro y listado de motores
- Registro y listado de tecnicos
- Registro e historial de mantenimientos
- Registro y seguimiento de fallas
- Registro y listado de inventario de repuestos
- Edicion y eliminacion (CRUD) en todos los modulos base
- Validaciones de campos obligatorios en formularios
- Alertas automaticas en dashboard (fallas, stock minimo y mantenimientos proximos)
- Busqueda y filtros por modulo
- Paginacion en listados
- Edicion en pantalla (sin `prompt`)
- Ordenamiento por campos (asc/desc)
- Exportacion CSV por modulo
- Notificaciones tipo toast para acciones y validaciones
- Rediseño visual empresarial (tema industrial electrico)
- Sistema de logs locales en `userData/logs`
- Backup automatico diario en `userData/backups` (retencion de ultimas copias)

## Estado actual de modulos

- `Dashboard`: KPIs + alertas automaticas
- `Motores`: CRUD, filtros, ordenamiento, paginacion, exportacion CSV
- `Mantenimientos`: CRUD, filtros, ordenamiento, paginacion, exportacion CSV
- `Fallas`: CRUD, filtros, ordenamiento, paginacion, exportacion CSV
- `Tecnicos`: CRUD, filtros, ordenamiento, paginacion, exportacion CSV
- `Inventario`: CRUD, filtros, ordenamiento, paginacion, exportacion CSV

## Notas tecnicas

- La base de datos es local/offline (`SQLite`) y se guarda en `proelectrica.db`.
- En algunos entornos Windows pueden aparecer warnings de cache GPU de Electron (`Access denied`), normalmente no bloqueantes para el funcionamiento.
- La interfaz actual utiliza una paleta corporativa oscura con acentos electricos (azul/amarillo), mejorando presentacion ejecutiva y legibilidad operativa.
- Si `better-sqlite3` no puede cargar por falta de toolchain nativo (Visual Studio Build Tools), la app usa fallback automatico `sql.js` para mantener operacion.

## Proximas etapas sugeridas

- Reportes PDF/Excel
- Bitacora de auditoria
- Relacion detallada de repuestos por mantenimiento
- Modulo de configuracion avanzada y parametros
- Backups automaticos