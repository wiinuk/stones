// server.js
import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const GEOJSON_PATH = path.join(__dirname, 'stone_db.geojson');
const PROGRESS_PATH = path.join(__dirname, 'verification_progress.json');

let verificationProgress = {};

// Load verification progress from file
if (existsSync(PROGRESS_PATH)) {
    try {
        verificationProgress = JSON.parse(readFileSync(PROGRESS_PATH, 'utf-8'));
        console.log('Loaded verification progress.');
    } catch (error) {
        console.error('Error loading verification progress:', error);
    }
} else {
    console.log('verification_progress.json not found, starting with empty progress.');
}

// Save verification progress to file
const saveProgress = () => {
    try {
        writeFileSync(PROGRESS_PATH, JSON.stringify(verificationProgress, null, 2), 'utf-8');
        console.log('Verification progress saved.');
    } catch (error) {
        console.error('Error saving verification progress:', error);
    }
};

// API to get all features with their verification status
app.get('/api/features', (req, res) => {
    if (!existsSync(GEOJSON_PATH)) {
        return res.status(404).send('stone_db.geojson not found.');
    }

    try {
        const geojsonData = JSON.parse(readFileSync(GEOJSON_PATH, 'utf-8'));
        
        // Assuming geojsonData is a FeatureCollection
        const featuresWithStatus = geojsonData.features.map((feature, index) => {
            // Assign a unique ID if not present, useful for tracking progress
            const id = feature.properties?.id || `feature-${index}`;
            return {
                ...feature,
                id: id,
                properties: {
                    ...feature.properties,
                    verificationStatus: verificationProgress[id] || 'pending'
                }
            };
        });
        res.json({ type: 'FeatureCollection', features: featuresWithStatus });

    } catch (error) {
        console.error('Error reading or parsing stone_db.geojson:', error);
        res.status(500).send('Error processing geojson data.');
    }
});

// API to update feature verification status
app.post('/api/update-status', (req, res) => {
    const { id, status } = req.body;

    if (!id || !status) {
        return res.status(400).send('Feature ID and status are required.');
    }

    verificationProgress[id] = status;
    saveProgress();
    res.json({ message: 'Status updated successfully', id, status });
});

// Serve static files from the 'dist' directory (Vite's build output)
app.use(express.static(path.join(__dirname, 'dist')));

// For any other routes, serve the main index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
