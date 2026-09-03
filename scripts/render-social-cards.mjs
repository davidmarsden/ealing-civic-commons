import { readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceDir = path.resolve("public/brand/social");
const outputDir = path.resolve("dist/brand/social");

await mkdir(outputDir, { recursive: true });

const files = (await readdir(sourceDir)).filter((name) => name.endsWith(".svg"));

for (const file of files) {
  const input = path.join(sourceDir, file);
  const output = path.join(outputDir, file.replace(/\.svg$/i, ".jpg"));

  await sharp(input, { density: 144 })
    .resize(1200, 630, { fit: "cover" })
    .flatten({ background: "#0f4a37" })
    .jpeg({ quality: 90, progressive: true, chromaSubsampling: "4:4:4" })
    .toFile(output);

  console.log(`Rendered ${path.basename(output)}`);
}
