let map;
let geojsonLayer;
let features = [];
let currentFeatureIndex = 0;
let progress = {};

const GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY"; // Replace with your actual API key

async function initMap() {
    // Dynamically load the Google Maps API script
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initializeMapAndData`;
    script.defer = true;
    document.head.appendChild(script);
}

async function initializeMapAndData() {
    // Initialize the map
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 35.6895, lng: 139.6917 }, // Centered on Tokyo (default)
        zoom: 8,
    });

    geojsonLayer = new google.maps.Data();
    geojsonLayer.setMap(map);

    // Fetch GeoJSON data and progress
    await fetchGeoJSON();
    await fetchProgress();

    // Add event listeners
    document.getElementById('prevBtn').addEventListener('click', showPreviousFeature);
    document.getElementById('nextBtn').addEventListener('click', showNextFeature);
    document.getElementById('toggleReviewedBtn').addEventListener('click', toggleReviewedStatus);

    displayCurrentFeature();
}

async function fetchGeoJSON() {
    try {
        const response = await fetch('/api/geojson');
        const data = await response.json();
        features = data.features.map((feature, index) => {
            // Assign a unique ID if not present, and store original index
            feature.properties.id = feature.properties.id || `feature-${index}`;
            feature.properties.originalIndex = index;
            return feature;
        });
        geojsonLayer.addGeoJson(data);

        // Style features based on reviewed status
        geojsonLayer.setStyle(feature => {
            const featureId = feature.getProperty('id');
            const isReviewed = progress[featureId];
            return {
                fillColor: isReviewed ? '#00FF00' : '#FF0000', // Green if reviewed, Red if not
                strokeColor: '#000000',
                strokeWeight: 1,
                fillOpacity: 0.5
            };
        });

        // Add click listener to features
        geojsonLayer.addListener('click', (event) => {
            const clickedFeatureId = event.feature.getProperty('id');
            const clickedFeatureIndex = features.findIndex(f => f.properties.id === clickedFeatureId);
            if (clickedFeatureIndex !== -1) {
                currentFeatureIndex = clickedFeatureIndex;
                displayCurrentFeature();
            }
        });

    } catch (error) {
        console.error('Error fetching GeoJSON:', error);
    }
}

async function fetchProgress() {
    try {
        const response = await fetch('/api/progress');
        progress = await response.json();
    } catch (error) {
        console.error('Error fetching progress:', error);
    }
}

function displayCurrentFeature() {
    if (features.length === 0) {
        document.getElementById('featureInfo').innerText = 'No features to display.';
        return;
    }

    const feature = features[currentFeatureIndex];
    const featureId = feature.properties.id;
    const isReviewed = progress[featureId] || false;

    // Update info panel
    document.getElementById('currentFeatureId').innerText = featureId;
    document.getElementById('currentFeatureStatus').innerText = isReviewed ? 'Reviewed' : 'Not Reviewed';
    document.getElementById('featureProperties').innerText = JSON.stringify(feature.properties, null, 2);

    // Center map on the current feature
    if (feature.geometry && feature.geometry.coordinates) {
        let center;
        if (feature.geometry.type === 'Point') {
            center = { lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] };
        } else if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
            const bounds = new google.maps.LatLngBounds();
            const processCoordinates = (coords) => {
                coords.forEach(coordSet => {
                    if (Array.isArray(coordSet[0])) { // Multi-dimensional array (e.g., Polygon, MultiPolygon)
                        processCoordinates(coordSet);
                    } else { // Single coordinate pair
                        bounds.extend({ lat: coordSet[1], lng: coordSet[0] });
                    }
                });
            };
            processCoordinates(feature.geometry.coordinates);
            center = bounds.getCenter();
        } else if (feature.geometry.type === 'LineString') {
             // For LineString, use the first point as center
            center = { lat: feature.geometry.coordinates[0][1], lng: feature.geometry.coordinates[0][0] };
        }

        if (center) {
            map.setCenter(center);
            map.setZoom(15); // Zoom in on the feature
        }
    }

    // Highlight the current feature (optional, but good for UX)
    geojsonLayer.overrideStyle(geojsonLayer.getFeatureById(featureId), { strokeWeight: 3, strokeColor: '#0000FF' });
    geojsonLayer.forEach(f => {
        if (f.getProperty('id') !== featureId) {
            const isFeatReviewed = progress[f.getProperty('id')] || false;
            geojsonLayer.overrideStyle(f, {
                fillColor: isFeatReviewed ? '#00FF00' : '#FF0000',
                strokeWeight: 1,
                strokeColor: '#000000',
                fillOpacity: 0.5
            });
        }
    });
}


function showNextFeature() {
    geojsonLayer.overrideStyle(geojsonLayer.getFeatureById(features[currentFeatureIndex].properties.id), { strokeWeight: 1, strokeColor: '#000000' });
    currentFeatureIndex = (currentFeatureIndex + 1) % features.length;
    displayCurrentFeature();
}

function showPreviousFeature() {
    geojsonLayer.overrideStyle(geojsonLayer.getFeatureById(features[currentFeatureIndex].properties.id), { strokeWeight: 1, strokeColor: '#000000' });
    currentFeatureIndex = (currentFeatureIndex - 1 + features.length) % features.length;
    displayCurrentFeature();
}

async function toggleReviewedStatus() {
    if (features.length === 0) return;

    const feature = features[currentFeatureIndex];
    const featureId = feature.properties.id;
    const isCurrentlyReviewed = progress[featureId] || false;
    const newStatus = !isCurrentlyReviewed;

    try {
        const response = await fetch('/api/progress', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: featureId, reviewed: newStatus }),
        });

        if (response.ok) {
            progress[featureId] = newStatus;
            displayCurrentFeature(); // Re-render to update status and style
            // Update the style of the specific feature on the map
            geojsonLayer.overrideStyle(geojsonLayer.getFeatureById(featureId), {
                fillColor: newStatus ? '#00FF00' : '#FF0000', // Green if reviewed, Red if not
                strokeColor: '#000000',
                strokeWeight: 1,
                fillOpacity: 0.5
            });
        } else {
            console.error('Failed to update progress:', response.statusText);
        }
    } catch (error) {
        console.error('Error updating progress:', error);
    }
}
