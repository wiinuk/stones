import { copyFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const submoduleGeo = path.join(
  __dirname,
  "..",
  "vendor",
  "map_data",
  "stone_db.geojson",
);
const publicGeo = path.join(__dirname, "..", "public", "stone_db.geojson");

const sourceGeo = submoduleGeo;

if (!existsSync(sourceGeo)) {
  console.error("Submodule stone_db.geojson not found at", sourceGeo);
  console.error("Please run: git submodule update --remote --init");
  process.exit(1);
}

try {
  copyFileSync(sourceGeo, publicGeo);
  console.log(`Copied stone_db.geojson from ${sourceGeo} to public directory.`);
} catch (err) {
  console.error("Failed to copy stone_db.geojson:", err);
  process.exit(1);
}
