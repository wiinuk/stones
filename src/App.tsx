// src/App.tsx
import { useState, useEffect } from 'react';
import { FixedSizeList } from 'react-window';
import './App.css';

interface FeatureProperties {
  name?: string;
  description?: string;
  verificationStatus: 'pending' | 'verified';
  [key: string]: any;
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

const ITEM_HEIGHT = 220; // Estimated height of each feature card including padding/margin

function App() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null); // New state for selected feature

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
      setFeatures(prevFeatures =>
        prevFeatures.map(feature =>
          feature.id === id ? { ...feature, properties: { ...feature.properties, verificationStatus: status } } : feature
        )
      );
      // If the selected feature's status is updated, also update selectedFeature
      if (selectedFeature && selectedFeature.id === id) {
        setSelectedFeature(prev => prev ? { ...prev, properties: { ...prev.properties, verificationStatus: status } } : null);
      }
    } catch (err) {
      setError('Failed to update status.');
      console.error(err);
    }
  };

  const FeatureRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const feature = features[index];
    if (!feature) return null;

    const isSelected = selectedFeature?.id === feature.id;

    return (
      <div className="feature-card-wrapper" style={style}>
        <div className={`feature-card ${isSelected ? 'selected' : ''}`}>
          <h2>{feature.properties?.name || `Feature ${feature.id}`}</h2>
          <p><strong>Status:</strong> <span className={`status-${feature.properties.verificationStatus}`}>{feature.properties.verificationStatus}</span></p>
          {feature.properties?.description && <p>{feature.properties.description}</p>}
          {feature.geometry && feature.geometry.type === 'Point' && (
            <p>
              <strong>Coordinates:</strong> {feature.geometry.coordinates[1]}, {feature.geometry.coordinates[0]}
            </p>
          )}
          {feature.geometry && feature.geometry.type === 'Point' && (
            <div className="actions">
              <button
                onClick={() => setSelectedFeature(feature)}
                className="show-on-map-button"
              >
                地図に表示
              </button>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${feature.geometry.coordinates[1]},${feature.geometry.coordinates[0]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="external-map-link-button"
              >
                Googleマップで開く
              </a>
            </div>
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
      </div>
    );
  };

  if (loading) {
    return <div className="app-container">Loading features...</div>;
  }

  if (error) {
    return <div className="app-container error">Error: {error}</div>;
  }

  const mapUrl = selectedFeature && selectedFeature.geometry && selectedFeature.geometry.type === 'Point'
    ? `https://maps.google.com/maps?q=${selectedFeature.geometry.coordinates[1]},${selectedFeature.geometry.coordinates[0]}&output=embed`
    : '';

  return (
    <div className="app-container">
      <h1>石のデータベース検証</h1>
      <p className="feature-count">表示中のFeature数: {features.length}</p>

      <div className="content-wrapper">
        <div className="feature-list-section">
          <div className="feature-list-container">
            <FixedSizeList
              height={600}
              itemCount={features.length}
              itemSize={ITEM_HEIGHT}
              width={'100%'}
            >
              {FeatureRow}
            </FixedSizeList>
          </div>
        </div>

        <div className="map-section">
          {selectedFeature ? (
            <div className="map-embed-container">
              <h2>選択中の地物: {selectedFeature.properties?.name || `Feature ${selectedFeature.id}`}</h2>
              <iframe
                src={mapUrl}
                width="100%"
                height="450"
                style={{ border: 0 }}
                allowFullScreen={false}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>
          ) : (
            <p>地物を選択すると地図が表示されます。</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;