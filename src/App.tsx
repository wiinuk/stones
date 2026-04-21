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
    } catch (err) {
      setError('Failed to update status.');
      console.error(err);
    }
  };

  const FeatureRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const feature = features[index];
    if (!feature) return null; // Should not happen with correct itemCount

    return (
      <div className="feature-card-wrapper" style={style}>
        <div className="feature-card">
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
      </div>
    );
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
      <p>表示中のFeature数: {features.length}</p> {/* Displaying total fetched features */}
      <div className="feature-list-container"> {/* New container for the virtualized list */}
        <FixedSizeList
          height={600} // Fixed height for the scrollable area
          itemCount={features.length}
          itemSize={ITEM_HEIGHT}
          width={'100%'}
        >
          {FeatureRow}
        </FixedSizeList>
      </div>
    </div>
  );
}

export default App;
