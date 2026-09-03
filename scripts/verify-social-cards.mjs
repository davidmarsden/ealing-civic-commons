import { access, stat } from "node:fs/promises";
import path from "node:path";

const socialSlugs = ["ealing", "acton", "ealing-town", "greenford", "hanwell", "northolt", "perivale", "southall"];
const townSlugs = socialSlugs.filter(slug => slug !== "ealing");

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
  const file = path.resolve(`dist/brand/towns/${slug}.svg`);
  await access(file);
  const info = await stat(file);
  if (info.size < 100) {
    throw new Error(`${slug}.svg looks unexpectedly small (${info.size} bytes)`);
  }
  console.log(`${slug}.svg ${info.size} bytes`);
}
