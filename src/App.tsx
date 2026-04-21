// src/App.tsx
import { useState, useEffect, useMemo } from 'react';
import { FixedSizeList } from 'react-window';
import './App.css';

interface FeatureProperties {
  name?: string;
  description?: string;
  verificationStatus: 'pending' | 'verified';
  contributor?: string;
  created_at?: string;
  place?: string | number;
  type?: string[];
  image?: string[];
  project?: string[];
  built_year?: string | number;
  built_year_ce?: number;
  photo_date?: string;
  address?: string;
  city_code?: number;
  mesh_code?: number;
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

const ITEM_HEIGHT = 120; // Adjusted item height for simplified list item
const LOCAL_STORAGE_SEARCH_KEY = 'stone_db_search_term';

// Define a curated list of properties for the details panel, and their Japanese labels
const DETAIL_PROPERTIES: { key: keyof FeatureProperties, label: string }[] = [
  { key: 'description', label: '説明' },
  { key: 'place', label: '場所' },
  { key: 'built_year', label: '建立年' },
  { key: 'built_year_ce', label: '建立年(西暦)' },
  { key: 'contributor', label: '投稿者' },
  { key: 'created_at', label: '登録日' },
  { key: 'photo_date', label: '撮影日' },
  { key: 'project', label: 'プロジェクト' },
  { key: 'city_code', label: '市コード' },
  { key: 'mesh_code', label: 'メッシュコード' },
  { key: 'image', label: '画像' }, // Just showing the presence, not actual images
];

function App() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>(
    localStorage.getItem(LOCAL_STORAGE_SEARCH_KEY) || ''
  );
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

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

  const copyCoordinatesToClipboard = async (latitude: number, longitude: number) => {
    const coordinatesString = `${latitude},${longitude}`;
    try {
      await navigator.clipboard.writeText(coordinatesString);
      setCopyFeedback('座標をコピーしました！');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      console.error('Failed to copy coordinates: ', err);
      setCopyFeedback('座標のコピーに失敗しました。');
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  const copyFeaturePropertiesToClipboard = async (properties: FeatureProperties) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(properties, null, 2));
      setCopyFeedback('Feature JSON (properties) をコピーしました！');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      console.error('Failed to copy feature properties JSON: ', err);
      setCopyFeedback('Feature JSON (properties) のコピーに失敗しました。');
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  const filteredFeatures = useMemo(() => {
    let currentFeatures = features;
    let textFilter = searchTerm.toLowerCase();
    let statusFilter: 'pending' | 'verified' | 'all' = 'all';

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

    const handleFeatureClick = () => {
      setSelectedFeature(feature);
    };

    return (
      <div className="feature-card-wrapper" style={style}>
        <div className={`feature-card ${isSelected ? 'selected' : ''}`} onClick={handleFeatureClick}>
          <h3>{feature.properties?.name || `Feature ${feature.id}`}</h3>
          <p><strong>種類:</strong> {Array.isArray(feature.properties?.type) ? feature.properties.type.join(', ') : 'N/A'}</p>
          <p><strong>住所:</strong> {feature.properties?.address || 'N/A'}</p>
          <div className="actions status-actions">
            <button
              onClick={(e) => { e.stopPropagation(); updateFeatureStatus(feature.id, 'verified'); }}
              disabled={feature.properties.verificationStatus === 'verified'}
            >
              完了
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); updateFeatureStatus(feature.id, 'pending'); }}
              disabled={feature.properties.verificationStatus === 'pending'}
            >
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
        {copyFeedback && <div className="copy-feedback">{copyFeedback}</div>}
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

        <div className="details-section"> {/* Renamed from map-section */}
          {selectedFeature ? (
            <div className="feature-details-panel">
              <h2>{selectedFeature.properties?.name || `Feature ${selectedFeature.id}`}</h2>
              <p><strong>Status:</strong> <span className={`status-${selectedFeature.properties.verificationStatus}`}>{selectedFeature.properties.verificationStatus === 'verified' ? '完了' : '未完了'}</span></p>

              {/* Display curated detail properties */}
              {DETAIL_PROPERTIES.map(prop => {
                const value = selectedFeature.properties[prop.key];
                if (value !== undefined && value !== null && value !== '') {
                  let displayValue: React.ReactNode;
                  if (Array.isArray(value)) {
                    displayValue = value.join(', ');
                  } else if (prop.key === 'image') {
                    displayValue = value.length > 0 ? 'あり' : 'なし';
                  } else {
                    displayValue = String(value);
                  }
                  return <p key={prop.key}><strong>{prop.label}:</strong> {displayValue}</p>;
                }
                return null;
              })}

              {selectedFeature.geometry && selectedFeature.geometry.type === 'Point' && (
                <p className="coordinates-display" onClick={() => copyCoordinatesToClipboard(selectedFeature.geometry.coordinates[1], selectedFeature.geometry.coordinates[0])}>
                  <strong>Coordinates:</strong> {selectedFeature.geometry.coordinates[1]}, {selectedFeature.geometry.coordinates[0]} (クリックでコピー)
                </p>
              )}

              <div className="actions">
                <button onClick={() => copyFeaturePropertiesToClipboard(selectedFeature.properties)} className="copy-json-button">
                  JSONをコピー
                </button>
              </div>

              {selectedFeature.geometry && selectedFeature.geometry.type === 'Point' && (
                <div className="map-embed-container">
                  <h3>地図</h3>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${selectedFeature.geometry.coordinates[1]},${selectedFeature.geometry.coordinates[0]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-map-link-button"
                  >
                    Googleマップで開く
                  </a>
                  <iframe
                    src={mapUrl}
                    width="100%"
                    height="300"
                    style={{ border: 0, marginTop: '10px' }}
                    allowFullScreen={false}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  ></iframe>
                </div>
              )}
            </div>
          ) : (
            <p className="select-feature-message">地物を選択すると詳細が表示されます。</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
