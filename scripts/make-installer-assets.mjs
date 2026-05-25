/**
 * Genera imágenes BMP e icono ICO para el instalador NSIS (electron-builder).
 * Fuente: build/installer-logo-src.png
 *
 * NSIS limita el header a 150×57 px: ahí NO va el logo (se pixela).
 * El logo va solo en la barra lateral (164×314 px) con buena resolución.
 */
import { Jimp } from "jimp";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

const SRC = resolve("build/installer-logo-src.png");
const SIDEBAR = resolve("build/installer-sidebar.bmp");
const HEADER = resolve("build/installer-header.bmp");
const INSTALLER_ICO = resolve("build/installer-icon.ico");

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

mkdirSync(resolve("build"), { recursive: true });

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function setPx(img, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= img.bitmap.width || y >= img.bitmap.height) return;
  img.setPixelColor(((r << 24) | (g << 16) | (b << 8) | a) >>> 0, x, y);
}

function fillGradient(img, top, bottom) {
  const { width, height } = img.bitmap;
  for (let y = 0; y < height; y++) {
    const t = y / Math.max(height - 1, 1);
    const r = lerp(top.r, bottom.r, t);
    const g = lerp(top.g, bottom.g, t);
    const b = lerp(top.b, bottom.b, t);
    for (let x = 0; x < width; x++) {
      setPx(img, x, y, r, g, b);
    }
  }
}

/** Escala con sobremuestreo 2× para reducir pixelado al encoger. */
function scaleLogo(logo, targetW, targetH) {
  const scale = Math.min(targetW / logo.bitmap.width, targetH / logo.bitmap.height);
  const w = Math.max(1, Math.round(logo.bitmap.width * scale));
  const h = Math.max(1, Math.round(logo.bitmap.height * scale));
  const hi = logo.clone().resize({ w: w * 2, h: h * 2 });
  return hi.resize({ w, h });
}

function compositeCenter(base, overlay, top = 0) {
  const x = Math.round((base.bitmap.width - overlay.bitmap.width) / 2);
  const y = Math.round(top + (base.bitmap.height - top - overlay.bitmap.height) / 2);
  base.composite(overlay, x, y);
}

async function loadLogo() {
  return Jimp.read(SRC);
}

async function makeSidebar() {
  const w = 164;
  const h = 314;
  const img = new Jimp({ width: w, height: h, color: 0x071018ff });

  const logo = scaleLogo(await loadLogo(), w, w);
  compositeCenter(img, logo, Math.round((h - logo.bitmap.height) / 2) - 8);

  await img.write(SIDEBAR);
  console.log(`✓ ${SIDEBAR}`);
}

/** Cabecera pequeña (150×57): franja de marca con logo reducido. */
async function makeHeader() {
  const w = 150;
  const h = 57;
  const img = new Jimp({ width: w, height: h, color: 0x071018ff });
  fillGradient(img, { r: 8, g: 16, b: 26 }, { r: 12, g: 22, b: 34 });

  const logo = scaleLogo(await loadLogo(), Math.round(w * 0.42), Math.round(h * 0.72));
  compositeCenter(img, logo, Math.round((h - logo.bitmap.height) / 2));

  for (let x = 0; x < w; x++) {
    setPx(img, x, 0, 47, 141, 255, 120);
    setPx(img, x, h - 1, 47, 141, 255, 60);
  }

  await img.write(HEADER);
  console.log(`✓ ${HEADER}`);
}

async function makeInstallerIcoFrame(size) {
  const bg = new Jimp({ width: size, height: size, color: 0x071018ff });
  const logo = scaleLogo(await loadLogo(), Math.round(size * 0.88), Math.round(size * 0.88));
  compositeCenter(bg, logo, 0);
  return bg.getBuffer("image/png");
}

async function makeInstallerIco() {
  const images = await Promise.all(ICO_SIZES.map(makeInstallerIcoFrame));

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let dataOffset = 6 + 16 * images.length;
  const dirEntries = [];

  for (let i = 0; i < images.length; i++) {
    const s = ICO_SIZES[i];
    const buf = images[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(s >= 256 ? 0 : s, 0);
    entry.writeUInt8(s >= 256 ? 0 : s, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(dataOffset, 12);
    dirEntries.push(entry);
    dataOffset += buf.length;
  }

  writeFileSync(INSTALLER_ICO, Buffer.concat([header, ...dirEntries, ...images]));
  console.log(`✓ ${INSTALLER_ICO}`);
}

async function main() {
  console.log("Generando assets del instalador NSIS...");
  await makeSidebar();
  await makeHeader();
  await makeInstallerIco();
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
