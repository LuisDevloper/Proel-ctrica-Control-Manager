import semver from "semver";

/**
 * Historial de versiones embebido en la app.
 * Actualizar en cada release para que los usuarios vean las novedades.
 */
export const CHANGELOG = [
  {
    version: "1.4.1",
    date: "2026-05-21",
    title: "Login, marca y pantalla de inicio",
    highlights: [
      "Tipografia corporativa Proélectrica / Control Manager (Plus Jakarta Sans)",
      "Fondo de login a pantalla completa sin cuadricula visible arriba",
      "Banner de comprobacion de actualizaciones visible en el login",
      "Marca unificada en splash, login y barra lateral",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-05-21",
    title: "Auditoria, reportes y mejoras operativas",
    highlights: [
      "Auditoria segura: el registro de actividad usa la sesion real del usuario",
      "Detalle de cambios (antes -> despues) en ediciones y acciones del sistema",
      "Dashboard exportable a PDF con reporte ejecutivo para gerencia",
      "Adjuntar PDF firmado al registrar envio a taller externo",
      "Filtros de busqueda en documentacion tecnica",
      "Grafico de estado de equipos incluye motores y turbinas",
      "Interfaz SIGEMT alineada en login y titulo de ventana",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-05-21",
    title: "Turbinas, taller externo e inventario avanzado",
    highlights: [
      "Modulo Equipos con pestanas: Motores, Turbinas y Taller externo",
      "Registro de turbinas (GG, PT, rodamientos, motor vinculado)",
      "Control logistico de envios a taller externo con estados",
      "Generacion y adjunto de PDF de permiso de salida y entrada",
      "Inventario con movimientos de entrada, salida y historial",
      "Documentos adjuntos en mantenimientos y equipos",
      "Ubicacion operativa en motores y turbinas",
      "Actualizaciones automaticas desde GitHub Releases",
      "Menu personalizado en espanol",
    ],
  },
  {
    version: "1.2.4",
    date: "2026-05-20",
    title: "Base operativa y exportaciones",
    highlights: [
      "Gestion de motores, mantenimientos, fallas, tecnicos e inventario",
      "Roles ADMIN, OPERADOR y VISOR",
      "Importacion y exportacion Excel con plantillas",
      "Exportacion PDF de listados e informes",
      "Dashboard con KPIs y graficas",
      "Copias de seguridad y restauracion de base de datos",
      "Tema claro / oscuro y accesibilidad de texto",
    ],
  },
];

export function getChangelogEntry(version) {
  if (!version) return null;
  const normalized = String(version).replace(/^v/i, "");
  return CHANGELOG.find((entry) => entry.version === normalized) || null;
}

export function getChangelogSorted() {
  return [...CHANGELOG].sort((a, b) => semver.rcompare(a.version, b.version));
}

export function isVersionNewer(candidate, current) {
  if (!candidate || !current) return false;
  const a = String(candidate).replace(/^v/i, "");
  const b = String(current).replace(/^v/i, "");
  if (!semver.valid(a) || !semver.valid(b)) return false;
  return semver.gt(a, b);
}

export function formatReleaseDate(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}
