/**
 * Copia el logo de la app a las fuentes usadas por icon.ico e instalador NSIS.
 * Fuente unica: src/renderer-react/public/logo.png
 */
import { copyFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(".");
const SRC = resolve(ROOT, "src/renderer-react/public/logo.png");
const TARGETS = [
  resolve(ROOT, "build/app-icon-src.png"),
  resolve(ROOT, "build/installer-logo-src.png"),
  resolve(ROOT, "docs/manual-usuario/img/logo.png"),
];

if (!existsSync(SRC)) {
  console.error("No se encontro el logo en:", SRC);
  process.exit(1);
}

mkdirSync(resolve(ROOT, "build"), { recursive: true });
mkdirSync(resolve(ROOT, "docs/manual-usuario/img"), { recursive: true });

for (const dest of TARGETS) {
  copyFileSync(SRC, dest);
  console.log(`✓ ${dest}`);
}

console.log("Logo sincronizado para icono .exe e instalador.");
