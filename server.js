// server.js
import express from "express";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const GEOJSON_PATH = path.join(__dirname, "stone_db.geojson");
// NOTE: Verification progress is stored per-user in the browser (localStorage)
// to allow this app to be deployed as a static site (e.g. GitHub Pages).
// Server no longer persists or manages verification_progress.json.

// API to get all features with their verification status
app.get("/api/features", (req, res) => {
  if (!existsSync(GEOJSON_PATH)) {
    return res.status(404).send("stone_db.geojson not found.");
  }

  try {
    const geojsonData = JSON.parse(readFileSync(GEOJSON_PATH, "utf-8"));
    // Return features as-is (ensuring each has an `id`).
    const features = geojsonData.features.map((feature, index) => {
      const id = feature.properties?.id || `feature-${index}`;
      return {
        ...feature,
        id,
        properties: { ...feature.properties },
      };
    });
    res.json({ type: "FeatureCollection", features });
  } catch (error) {
    console.error("Error reading or parsing stone_db.geojson:", error);
    res.status(500).send("Error processing geojson data.");
  }
});

// Serve raw geojson file at root path for client-side fetching
app.get("/stone_db.geojson", (req, res) => {
  if (!existsSync(GEOJSON_PATH)) {
    return res.status(404).send("stone_db.geojson not found.");
  }
  res.sendFile(GEOJSON_PATH);
});
// NOTE: No server-side API to update status. Client must store status locally.

// Serve static files from the 'dist' directory (Vite's build output)
app.use(express.static(path.join(__dirname, "dist")));

// For any other routes, serve the main index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
