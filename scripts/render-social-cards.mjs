import { readdir, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const publicDir = path.resolve("public");
const sourceDir = path.resolve("public/brand/social");
const outputDir = path.resolve("dist/brand/social");
const townOutputDir = path.resolve("dist/brand/towns");
const networkSource = path.resolve("public/network/brand/social.svg");
const networkOutput = path.resolve("dist/network/brand/social.jpg");
const ealingOak = path.resolve("public/brand/ealing-oak-approved.webp");

await mkdir(outputDir, { recursive: true });
await mkdir(townOutputDir, { recursive: true });
await mkdir(path.dirname(networkOutput), { recursive: true });

const files = (await readdir(sourceDir)).filter((name) => name.endsWith(".svg"));
const staticTownMarks = new Set(["acton", "greenford", "northolt", "perivale"]);
const mimeFor = ext => ({
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
}[ext.toLowerCase()]);

async function svgWithEmbeddedAssets(file, { omitEalingOak = false } = {}) {
  let svg = await readFile(file, "utf8");
  if (omitEalingOak) {
    svg = svg.replace(/\s*<image href="\/brand\/ealing-oak-approved\.webp"[^>]*\/>/i, "");
  }

  const refs = [...svg.matchAll(/href="(\/[^\"]+\.(?:svg|webp|png|jpe?g))"/gi)];
  for (const [, href] of refs) {
    const assetPath = path.join(publicDir, href.replace(/^\//, ""));
    const asset = await readFile(assetPath);
    const mime = mimeFor(path.extname(assetPath));
    if (!mime) throw new Error(`Unsupported embedded social-card asset: ${href}`);
    const dataUri = `data:${mime};base64,${asset.toString("base64")}`;
    svg = svg.replaceAll(`href="${href}"`, `href="${dataUri}"`);
  }

  return Buffer.from(svg);
}

for (const file of files) {
  const input = path.join(sourceDir, file);
  const slug = file.replace(/\.svg$/i, "");
  const output = path.join(outputDir, `${slug}.jpg`);
  const source = await svgWithEmbeddedAssets(input, { omitEalingOak: slug === "ealing" });

  if (slug === "ealing") {
    const base = await sharp(source, { density: 144 })
      .resize(1200, 630, { fit: "cover" })
      .flatten({ background: "#0f4a37" })
      .png()
      .toBuffer();
    const oak = await sharp(ealingOak)
      .resize(300, 266, { fit: "contain" })
      .png()
      .toBuffer();

    await sharp(base)
      .composite([{ input: oak, left: 54, top: 64 }])
      .jpeg({ quality: 90, progressive: true, chromaSubsampling: "4:4:4" })
      .toFile(output);
  } else {
    await sharp(source, { density: 144 })
      .resize(1200, 630, { fit: "cover" })
      .flatten({ background: "#0f4a37" })
      .jpeg({ quality: 90, progressive: true, chromaSubsampling: "4:4:4" })
      .toFile(output);
  }

  console.log(`Rendered ${path.basename(output)}`);

  if (slug !== "ealing" && !staticTownMarks.has(slug)) {
    const badgeOutput = path.join(townOutputDir, `${slug}.webp`);
    await sharp(output)
      .extract({ left: 39, top: 69, width: 352, height: 352 })
      .resize(256, 256)
      .webp({ quality: 90 })
      .toFile(badgeOutput);
    console.log(`Rendered ${path.relative(path.resolve("dist"), badgeOutput)}`);
  }
}

await sharp(networkSource, { density: 144 })
  .resize(1200, 630, { fit: "cover" })
  .flatten({ background: "#f4f0e4" })
  .jpeg({ quality: 90, progressive: true, chromaSubsampling: "4:4:4" })
  .toFile(networkOutput);

console.log(`Rendered ${path.relative(path.resolve("dist"), networkOutput)}`);
