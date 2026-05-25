/**
 * Aclara el texto azul oscuro del logo para mejor contraste sobre fondos oscuros.
 * Uso: node scripts/enhance-logo-text.mjs [entrada] [salida]
 */
import { Jimp } from "jimp";
import { resolve } from "path";

const input = resolve(process.argv[2] || "src/renderer-react/public/logo.png");
const output = resolve(process.argv[3] || input);

function isWhiteStroke(r, g, b, a) {
  return a > 20 && r > 210 && g > 210 && b > 210;
}

/** Texto azul oscuro del wordmark (no trazos blancos del isotipo). */
function isDarkBlueText(r, g, b, a) {
  if (a < 20) return false;
  if (isWhiteStroke(r, g, b, a)) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 35) return false;
  if (max > 210) return false;
  return b > r + 6 && b >= g - 8 && b > 70;
}

function lightenBlueText(r, g, b) {
  const mix = 0.32;
  const targetR = 95;
  const targetG = 140;
  const targetB = 205;
  return [
    Math.round(r + (targetR - r) * mix),
    Math.round(g + (targetG - g) * mix),
    Math.round(b + (targetB - b) * mix),
  ];
}

const img = await Jimp.read(input);
const { data } = img.bitmap;

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const a = data[i + 3];

  if (isDarkBlueText(r, g, b, a)) {
    const [nr, ng, nb] = lightenBlueText(r, g, b);
    data[i] = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
  }
}

await img.write(output);
console.log(`Texto del logo aclarado: ${output}`);
