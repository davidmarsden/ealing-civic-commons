import { access, stat } from "node:fs/promises";
import path from "node:path";

const towns = ["ealing", "acton", "ealing-town", "greenford", "hanwell", "northolt", "perivale", "southall"];

for (const town of towns) {
  const file = path.resolve(`dist/brand/social/${town}.jpg`);
  await access(file);
  const info = await stat(file);
  if (info.size < 10_000) {
    throw new Error(`${town}.jpg looks unexpectedly small (${info.size} bytes)`);
  }
  console.log(`${town}.jpg ${info.size} bytes`);
}
