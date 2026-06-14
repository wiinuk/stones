import { copyFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootGeo = path.join(__dirname, "..", "stone_db.geojson");
const publicGeo = path.join(__dirname, "..", "public", "stone_db.geojson");

if (!existsSync(rootGeo)) {
  console.error("Source stone_db.geojson not found at", rootGeo);
  process.exit(1);
}

try {
  copyFileSync(rootGeo, publicGeo);
  console.log("Copied stone_db.geojson to public directory.");
} catch (err) {
  console.error("Failed to copy stone_db.geojson:", err);
  process.exit(1);
}
