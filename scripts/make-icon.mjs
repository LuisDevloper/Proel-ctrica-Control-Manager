/**
 * Genera build/icon.ico con múltiples tamaños.
 * Usa PNG-in-ICO (válido desde Vista) — formato estándar que electron-builder acepta.
 * Fuente: build/app-icon-src.png
 */
import { Jimp } from "jimp";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const src  = resolve("build/app-icon-src.png");
const dest = resolve("build/icon.ico");

mkdirSync("build", { recursive: true });

// Tamaños requeridos por Windows (256 es obligatorio para alta resolución)
const SIZES = [16, 24, 32, 48, 64, 128, 256];

async function makeFrame(size) {
  const r = Math.round(size * 0.22); // radio de esquinas ~22%

  // Fondo sólido oscuro
  const bg = new Jimp({ width: size, height: size, color: 0x0d1825ff });

  // Logo con autocrop y escala al 80%
  const logo = await Jimp.read(src);
  logo.autocrop({ tolerance: 0.03, cropOnlyFrames: false });
  const logoSize = Math.round(size * 0.80);
  logo.resize({ w: logoSize, h: logoSize });

  // Centrar logo sobre fondo
  const offset = Math.round((size - logoSize) / 2);
  bg.composite(logo, offset, offset);

  // Esquinas redondeadas (máscara circular en las 4 esquinas)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inTL = x < r       && y < r;
      const inTR = x >= size-r && y < r;
      const inBL = x < r       && y >= size-r;
      const inBR = x >= size-r && y >= size-r;
      if (inTL || inTR || inBL || inBR) {
        const cx = (inTL || inBL) ? r : size - r;
        const cy = (inTL || inTR) ? r : size - r;
        if (Math.sqrt((x-cx)**2 + (y-cy)**2) > r) {
          bg.setPixelColor(0x00000000, x, y);
        }
      }
    }
  }

  return bg.getBuffer("image/png");
}

async function buildIco() {
  console.log(`Generando ${dest}...`);

  const images = await Promise.all(SIZES.map(makeFrame));

  // Cabecera ICO: reserved(2) + type(2)=1 + count(2)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  // Directorio de entradas (16 bytes por imagen)
  const dirSize = 16 * images.length;
  let dataOffset = 6 + dirSize;

  const dirEntries = [];
  for (let i = 0; i < images.length; i++) {
    const s   = SIZES[i];
    const buf = images[i];
    const entry = Buffer.alloc(16);
    // width/height: 0 significa 256 en el formato ICO
    entry.writeUInt8(s >= 256 ? 0 : s, 0);
    entry.writeUInt8(s >= 256 ? 0 : s, 1);
    entry.writeUInt8(0, 2);   // color count (0 = sin paleta)
    entry.writeUInt8(0, 3);   // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits por píxel
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(dataOffset, 12);
    dirEntries.push(entry);
    dataOffset += buf.length;
  }

  const ico = Buffer.concat([header, ...dirEntries, ...images]);
  writeFileSync(dest, ico);
  console.log(`✓ ${dest} — ${images.length} tamaños, ${(ico.length / 1024).toFixed(1)} KB`);
}

buildIco().catch(e => { console.error("Error:", e.message); process.exit(1); });
