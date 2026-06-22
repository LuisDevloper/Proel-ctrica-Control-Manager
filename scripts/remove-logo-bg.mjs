/**
 * Quita el fondo claro del logo de login preservando texto azul e icono blanco.
 * Uso: node scripts/remove-logo-bg.mjs [entrada] [salida]
 */
import { Jimp } from "jimp";
import { resolve } from "path";

const input = resolve(process.argv[2] || "src/renderer-react/public/logo-login.png");
const output = resolve(process.argv[3] || "src/renderer-react/public/logo-login.png");

function classify(r, g, b, a) {
  if (a < 8) return "transparent";

  // Texto e isotipo azul marino
  if (b > 90 && r < 120 && g < 125 && b > r + 8 && b >= g - 5) {
    return "foreground";
  }

  // Trazos blancos del isotipo (mas estricto que el fondo claro)
  if (r > 249 && g > 249 && b > 249) {
    return "foreground";
  }

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;

  // Fondo claro / gris / cuadricula de exportacion
  if (max >= 175 && sat <= 42) {
    return "background";
  }

  return "foreground";
}

const img = await Jimp.read(input);
const { data } = img.bitmap;

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const a = data[i + 3];
  const kind = classify(r, g, b, a);
  if (kind === "background" || kind === "transparent") {
    data[i + 3] = 0;
  }
}

await img.write(output);
console.log(`Logo sin fondo guardado en: ${output}`);
