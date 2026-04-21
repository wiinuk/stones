// src/App.tsx
import { useState, useEffect, useMemo } from 'react';
import { FixedSizeList } from 'react-window';
import './App.css';

interface FeatureProperties {
  name?: string;
  description?: string;
  verificationStatus: 'pending' | 'verified';
  contributor?: string;
  place?: string | number;
  built_year?: string | number;
  address?: string;
  type?: string[];
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

const ITEM_HEIGHT = 220;
const LOCAL_STORAGE_SEARCH_KEY = 'stone_db_search_term';

function App() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>(
    localStorage.getItem(LOCAL_STORAGE_SEARCH_KEY) || ''
  );

  useEffect(() => {
    fetchFeatures();
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_SEARCH_KEY, searchTerm);
  }, [searchTerm]);

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
      if (selectedFeature && selectedFeature.id === id) {
        setSelectedFeature(prev => prev ? { ...prev, properties: { ...prev.properties, verificationStatus: status } } : null);
      }
    } catch (err) {
      setError('Failed to update status.');
      console.error(err);
    }
  };

  const filteredFeatures = useMemo(() => {
    let currentFeatures = features;
    let textFilter = searchTerm.toLowerCase();
    let statusFilter: 'pending' | 'verified' | 'all' = 'all';

    // Check for status keywords
    const statusKeywords = {
      ' @confirmed': 'verified',
      ' @完了': 'verified',
      ' @pending': 'pending',
      ' @未完了': 'pending',
    };

    for (const keyword in statusKeywords) {
      if (textFilter.endsWith(keyword)) {
        statusFilter = statusKeywords[keyword as keyof typeof statusKeywords] as 'pending' | 'verified';
        textFilter = textFilter.slice(0, textFilter.length - keyword.length).trim();
        break;
      }
    }

    if (statusFilter !== 'all') {
      currentFeatures = currentFeatures.filter(feature =>
        feature.properties.verificationStatus === statusFilter
      );
    }

    if (textFilter) {
      currentFeatures = currentFeatures.filter(feature => {
        const props = feature.properties;

        const checkProperty = (value: string | number | undefined | string[]) => {
          if (Array.isArray(value)) {
            return value.some(item => typeof item === 'string' && item.toLowerCase().includes(textFilter));
          }
          return typeof value === 'string' && value.toLowerCase().includes(textFilter);
        };
        
        const checkNumberProperty = (value: string | number | undefined) => {
          return typeof value === 'number' && String(value).includes(textFilter);
        };

        return (
          checkProperty(props.name) ||
          checkProperty(props.description) ||
          checkProperty(props.address) ||
          checkProperty(props.contributor) ||
          checkProperty(props.type) ||
          checkProperty(props.place) ||
          checkNumberProperty(props.place) ||
          checkProperty(props.built_year) ||
          checkNumberProperty(props.built_year)
        );
      });
    }

    return currentFeatures;
  }, [features, searchTerm]);

  const { verifiedCount, pendingCount } = useMemo(() => {
    const counts = { verifiedCount: 0, pendingCount: 0 };
    filteredFeatures.forEach(feature => {
      if (feature.properties.verificationStatus === 'verified') {
        counts.verifiedCount++;
      } else {
        counts.pendingCount++;
      }
    });
    return counts;
  }, [filteredFeatures]);


  const FeatureRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const feature = filteredFeatures[index];
    if (!feature) return null;

    const isSelected = selectedFeature?.id === feature.id;

    return (
      <div className="feature-card-wrapper" style={style}>
        <div className={`feature-card ${isSelected ? 'selected' : ''}`}>
          <h2>{feature.properties?.name || `Feature ${feature.id}`}</h2>
          <p><strong>Status:</strong> <span className={`status-${feature.properties.verificationStatus}`}>{feature.properties.verificationStatus === 'verified' ? '完了' : '未完了'}</span></p>
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
              完了
            </button>
            <button onClick={() => updateFeatureStatus(feature.id, 'pending')} disabled={feature.properties.verificationStatus === 'pending'}>
              未完了
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
      <div className="filter-section">
        <input
          type="text"
          placeholder="地物をフィルタ (例: 東京都 @未完了)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <p className="feature-count">
          表示中のFeature数: {filteredFeatures.length} / 全Feature数: {features.length}
          (完了: <span className="status-verified">{verifiedCount}</span>, 未完了: <span className="status-pending">{pendingCount}</span>)
        </p>
      </div>


      <div className="content-wrapper">
        <div className="feature-list-section">
          <div className="feature-list-container">
            <FixedSizeList
              height={600}
              itemCount={filteredFeatures.length}
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
