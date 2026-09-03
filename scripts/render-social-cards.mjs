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

    if (slug === "northolt") {
      // Do not decode the embedded JPEG independently: the source payload in
      // this legacy SVG is malformed enough for libjpeg to reject it with
      // "Bogus marker length". librsvg can nevertheless render the complete
      // approved social card successfully, as proven by northolt.jpg above.
      // Render the SVG once more and crop the approved roundel directly in the
      // same pipeline, avoiding both the corrupt-JPEG decode and a JPEG
      // round-trip.
      await sharp(input, { density: 144 })
        .resize(1200, 630, { fit: "cover" })
        .flatten({ background: "#0f4a37" })
        .extract({ left: 39, top: 69, width: 352, height: 352 })
        .resize(256, 256)
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
