/**
 * Exporta el changelog embebido a JSON para consulta remota durante actualizaciones.
 */
import { writeFileSync } from "fs";
import { resolve } from "path";
import { CHANGELOG } from "../src/renderer-react/data/changelog.js";

const dest = resolve("changelog-manifest.json");
const payload = {
  generatedAt: new Date().toISOString(),
  entries: CHANGELOG,
};

writeFileSync(dest, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`✓ ${dest} (${CHANGELOG.length} versiones)`);
