import { readdir, mkdir, readFile } from "node:fs/promises";
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

    if (slug === "northolt") {
      // Northolt's approved roundel is already embedded as a JPEG inside the
      // approved social-card SVG. Extract that source image directly rather
      // than rasterising/cropping the SVG: librsvg/Sharp has proved unreliable
      // with this SVG's clipPath/image combination and can yield a blank badge.
      const svg = await readFile(input, "utf8");
      const match = svg.match(/href="data:image\/jpeg;base64,([^"]+)"/i);
      if (!match) throw new Error("Northolt social card does not contain its embedded JPEG roundel");
      const badgeJpeg = Buffer.from(match[1], "base64");
      await sharp(badgeJpeg)
        .resize(256, 256, { fit: "cover" })
        .webp({ quality: 92 })
        .toFile(badgeOutput);
    } else {
      await sharp(output)
        .extract({ left: 39, top: 69, width: 352, height: 352 })
        .resize(256, 256)
        .webp({ quality: 90 })
        .toFile(badgeOutput);
    }

    console.log(`Rendered ${path.relative(path.resolve("dist"), badgeOutput)}`);
  }
}
