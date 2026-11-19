import sharp from "sharp";
import { readFileSync } from "node:fs";

const [, , input, output, width, height] = process.argv;
if (!input || !output || !width || !height) {
  console.error("usage: node render.mjs <input.svg> <output.png> <width> <height>");
  process.exit(1);
}

const svg = readFileSync(input);
await sharp(svg, { density: 72 })
  .resize(Number(width), Number(height))
  .png()
  .toFile(output);

console.log(`ok: ${output} ${width}x${height}`);
