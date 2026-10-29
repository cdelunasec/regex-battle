/**
 * Prepara los personajes para la web.
 *
 *   node scripts/prepare-sprites.mjs <carpeta-con-los-originales>
 *
 * Los originales vienen de un generador de imágenes: pesan más de dos megas
 * cada uno, miden casi tres mil píxeles de ancho y traen un fondo gris plano.
 * Así no se pueden usar. Este script hace tres cosas:
 *
 *   1. Quita el fondo. No borra "todo lo que sea gris", porque las armas son
 *      gris oscuro y los ojos son casi blancos. Hace un relleno por inundación
 *      desde los bordes, así que solo desaparece el gris que está conectado
 *      con el borde de la imagen, y lo que hay dentro del personaje se queda.
 *   2. Recorta al contenido, para que el personaje no venga rodeado de vacío.
 *   3. Reduce a un tamaño razonable y guarda PNG con transparencia.
 *
 * Los originales NO se versionan, pesan quince megas entre todos. Lo que se
 * commitea es el resultado, que baja a menos de un mega en total.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

/** Qué archivo es cada pose. Las poses son las que usa `Fighter.tsx`. */
const SPRITES = [
  { file: "Gemini_Generated_Image_gq4e3dgq4e3dgq4e.jpg", out: "rojo-guardia.png" },
  { file: "Gemini_Generated_Image_iuos8hiuos8hiuos.jpg", out: "rojo-disparo.png" },
  { file: "Gemini_Generated_Image_4ppz8k4ppz8k4ppz.jpg", out: "rojo-ko.png" },
  { file: "Gemini_Generated_Image_nw4mpynw4mpynw4m.jpg", out: "azul-guardia.png" },
  { file: "Gemini_Generated_Image_g2jx7bg2jx7bg2jx.jpg", out: "azul-disparo.png" },
  { file: "Gemini_Generated_Image_7rql4k7rql4k7rql.jpg", out: "azul-golpe.png" },
  { file: "Gemini_Generated_Image_oxxq0koxxq0koxxq.jpg", out: "azul-ko.png" },
];

/** Ancho final. El doble de lo que se muestra, para que se vea bien en pantallas densas. */
const TARGET_WIDTH = 520;

/** Cuánto se puede alejar un píxel del color de fondo y seguir contando como fondo. */
const TOLERANCE = 58;

const sourceDir = process.argv[2];
const outDir = join(process.cwd(), "public", "fighters");

if (!sourceDir) {
  console.error("Falta la carpeta de originales.\n  node scripts/prepare-sprites.mjs <carpeta>");
  process.exit(1);
}

/**
 * Borra el fondo por inundación desde los bordes.
 *
 * Se siembra en las cuatro esquinas y se propaga a los vecinos que sigan
 * pareciéndose al fondo. Al no saltar de una región a otra, el gris del arma
 * o el blanco de un ojo se quedan intactos aunque se parezcan al fondo.
 */
function clearBackground(data, width, height) {
  const size = width * height;
  const visited = new Uint8Array(size);
  // El color de fondo se toma de la esquina, no se adivina.
  const bg = [data[0], data[1], data[2]];

  const closeToBackground = (index) => {
    const p = index * 4;
    return (
      Math.abs(data[p] - bg[0]) <= TOLERANCE &&
      Math.abs(data[p + 1] - bg[1]) <= TOLERANCE &&
      Math.abs(data[p + 2] - bg[2]) <= TOLERANCE
    );
  };

  const stack = [];
  for (let x = 0; x < width; x++) {
    stack.push(x, (height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    stack.push(y * width, y * width + width - 1);
  }

  while (stack.length > 0) {
    const index = stack.pop();
    if (visited[index]) continue;
    visited[index] = 1;
    if (!closeToBackground(index)) continue;

    data[index * 4 + 3] = 0;

    const x = index % width;
    const y = (index - x) / width;
    if (x > 0) stack.push(index - 1);
    if (x < width - 1) stack.push(index + 1);
    if (y > 0) stack.push(index - width);
    if (y < height - 1) stack.push(index + width);
  }

  // El JPEG deja un halo alrededor del contorno negro. Suavizar el alfa con los
  // vecinos disimula ese borde sucio sin comerse el dibujo.
  const alpha = new Uint8Array(size);
  for (let i = 0; i < size; i++) alpha[i] = data[i * 4 + 3];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (alpha[i] === 0) continue;
      const around =
        alpha[i - 1] + alpha[i + 1] + alpha[i - width] + alpha[i + width] + alpha[i] * 4;
      data[i * 4 + 3] = Math.round(around / 8);
    }
  }
}

await mkdir(outDir, { recursive: true });
let total = 0;

for (const sprite of SPRITES) {
  const input = await readFile(join(sourceDir, sprite.file)).catch(() => null);
  if (!input) {
    console.log(`SALTADO  ${sprite.out}  (no está ${sprite.file})`);
    continue;
  }

  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  clearBackground(data, info.width, info.height);

  const output = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 1 })
    .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toBuffer();

  await writeFile(join(outDir, sprite.out), output);
  total += output.length;
  const meta = await sharp(output).metadata();
  console.log(
    `${sprite.out.padEnd(18)} ${meta.width}x${meta.height}  ${(output.length / 1024).toFixed(0)} KB`,
  );
}

console.log(`\nTotal: ${(total / 1024).toFixed(0)} KB en public/fighters`);
