const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); // Enable JSON body parsing

const GEOJSON_FILE = 'stone_db.geojson';
const PROGRESS_FILE = 'progress.json';

// Initialize progress file if it doesn't exist
if (!fs.existsSync(PROGRESS_FILE)) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify({}));
}

// API endpoint to get GeoJSON data
app.get('/api/geojson', (req, res) => {
    fs.readFile(GEOJSON_FILE, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading geojson file:', err);
            return res.status(500).send('Error reading geojson file');
        }
        res.json(JSON.parse(data));
    });
});

// API endpoint to get progress data
app.get('/api/progress', (req, res) => {
    fs.readFile(PROGRESS_FILE, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading progress file:', err);
            return res.status(500).send('Error reading progress file');
        }
        res.json(JSON.parse(data));
    });
});

// API endpoint to update progress data
app.post('/api/progress', (req, res) => {
    const { id, reviewed } = req.body;
    if (id === undefined || reviewed === undefined) {
        return res.status(400).send('Missing id or reviewed status');
    }

    fs.readFile(PROGRESS_FILE, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading progress file:', err);
            return res.status(500).send('Error reading progress file');
        }
        const progress = JSON.parse(data);
        progress[id] = reviewed;

        fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf8', (err) => {
            if (err) {
                console.error('Error writing progress file:', err);
                return res.status(500).send('Error writing progress file');
            }
            res.status(200).send('Progress updated');
        });
    });
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
