// src/App.tsx
import { useState, useEffect } from 'react';
import './App.css';

interface FeatureProperties {
  name?: string;
  description?: string;
  // Add other properties if known from stone_db.geojson
  verificationStatus: 'pending' | 'verified';
  [key: string]: any; // Allow for arbitrary properties
}

interface Feature {
  id: string;
  type: string;
  geometry: {
    type: string;
    coordinates: number[]; // [longitude, latitude]
  };
  properties: FeatureProperties;
}

function App() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    try {
      const response = await fetch('/api/features');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setFeatures(data.features);
    } catch (err) {
      setError('Failed to fetch features.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateFeatureStatus = async (id: string, status: 'pending' | 'verified') => {
    try {
      const response = await fetch('/api/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, status }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      // Optimistically update the UI or re-fetch features
      setFeatures(prevFeatures =>
        prevFeatures.map(feature =>
          feature.id === id ? { ...feature, properties: { ...feature.properties, verificationStatus: status } } : feature
        )
      );
    } catch (err) {
      setError('Failed to update status.');
      console.error(err);
    }
  };

  if (loading) {
    return <div className="app-container">Loading features...</div>;
  }

  if (error) {
    return <div className="app-container error">Error: {error}</div>;
  }

  return (
    <div className="app-container">
      <h1>石のデータベース検証</h1>
      <div className="feature-list">
        {features.map(feature => (
          <div key={feature.id} className="feature-card">
            <h2>{feature.properties?.name || `Feature ${feature.id}`}</h2>
            <p><strong>Status:</strong> <span className={`status-${feature.properties.verificationStatus}`}>{feature.properties.verificationStatus}</span></p>
            {feature.properties?.description && <p>{feature.properties.description}</p>}
            {feature.geometry && feature.geometry.type === 'Point' && (
              <p>
                <strong>Coordinates:</strong> {feature.geometry.coordinates[1]}, {feature.geometry.coordinates[0]}
              </p>
            )}
            {feature.geometry && feature.geometry.type === 'Point' && (
              <p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${feature.geometry.coordinates[1]},${feature.geometry.coordinates[0]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Googleマップで確認
                </a>
              </p>
            )}
            <div className="actions">
              <button onClick={() => updateFeatureStatus(feature.id, 'verified')} disabled={feature.properties.verificationStatus === 'verified'}>
                Verified
              </button>
              <button onClick={() => updateFeatureStatus(feature.id, 'pending')} disabled={feature.properties.verificationStatus === 'pending'}>
                Pending
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;