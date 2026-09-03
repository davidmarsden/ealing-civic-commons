import { access, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const socialSlugs = ["ealing", "acton", "ealing-town", "greenford", "hanwell", "northolt", "perivale", "southall"];
const staticTownMarks = new Set(["acton", "greenford", "northolt", "perivale"]);
const townSlugs = socialSlugs.filter(slug => slug !== "ealing");
const generatedTownSlugs = townSlugs.filter(slug => !staticTownMarks.has(slug));

for (const slug of socialSlugs) {
  const file = path.resolve(`dist/brand/social/${slug}.jpg`);
  await access(file);
  const info = await stat(file);
  if (info.size < 10_000) {
    throw new Error(`${slug}.jpg looks unexpectedly small (${info.size} bytes)`);
  }
  console.log(`${slug}.jpg ${info.size} bytes`);
}

for (const slug of townSlugs) {
  const svg = path.resolve(`dist/brand/towns/${slug}.svg`);
  await access(svg);
  const svgInfo = await stat(svg);
  if (svgInfo.size < 100) {
    throw new Error(`${slug}.svg looks unexpectedly small (${svgInfo.size} bytes)`);
  }
  console.log(`${slug}.svg ${svgInfo.size} bytes`);
}

for (const slug of generatedTownSlugs) {
  const webp = path.resolve(`dist/brand/towns/${slug}.webp`);
  await access(webp);
  const metadata = await sharp(webp).metadata();
  if (metadata.width !== 256 || metadata.height !== 256) {
    throw new Error(`${slug}.webp has unexpected dimensions ${metadata.width}x${metadata.height}`);
  }
  const stats = await sharp(webp).stats();
  const variation = Math.max(...stats.channels.slice(0, 3).map(channel => channel.stdev));
  if (variation < 8) {
    throw new Error(`${slug}.webp appears blank or nearly uniform (max channel stdev ${variation.toFixed(2)})`);
  }
  console.log(`${slug}.webp 256x256 variation ${variation.toFixed(2)}`);
}
