import { readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceDir = path.resolve("public/brand/social");
const outputDir = path.resolve("dist/brand/social");
const townOutputDir = path.resolve("dist/brand/towns");

await mkdir(outputDir, { recursive: true });
await mkdir(townOutputDir, { recursive: true });

const files = (await readdir(sourceDir)).filter((name) => name.endsWith(".svg"));

for (const file of files) {
  const input = path.join(sourceDir, file);
  const slug = file.replace(/\.svg$/i, "");
  const output = path.join(outputDir, `${slug}.jpg`);

  await sharp(input, { density: 144 })
    .resize(1200, 630, { fit: "cover" })
    .flatten({ background: "#0f4a37" })
    .jpeg({ quality: 90, progressive: true, chromaSubsampling: "4:4:4" })
    .toFile(output);

  console.log(`Rendered ${path.basename(output)}`);

  if (slug !== "ealing") {
    const badgeOutput = path.join(townOutputDir, `${slug}.webp`);

    // Every town badge is derived in exactly the same way from the rendered
    // 1200x630 social card. Keeping Northolt on this common path avoids the
    // special-case SVG/JPEG decoding and crop bugs introduced in PR #64.
    await sharp(output)
      .extract({ left: 39, top: 69, width: 352, height: 352 })
      .resize(256, 256)
      .webp({ quality: 90 })
      .toFile(badgeOutput);

    console.log(`Rendered ${path.relative(path.resolve("dist"), badgeOutput)}`);
  }
}
