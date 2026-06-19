// src/App.tsx
import { useState, useEffect, useMemo, useRef } from "react";
import { matchFeatureFromQuery } from "./search/query";
import type { Feature, FeatureProperties } from "./types";
import { isStatus } from "./types";
import { VERSION } from "./version";
import { FixedSizeList } from "react-window";
import "./App.css";

// Use shared Feature types from src/types.ts

const ITEM_HEIGHT = 80; // Adjusted item height for simplified list item
const LOCAL_STORAGE_SEARCH_KEY = "stone_db_search_term";
const LOCAL_STORAGE_PROGRESS_KEY = "verification_progress";

const DETAIL_PROPERTIES: { key: keyof FeatureProperties; label: string }[] = [
  { key: "description", label: "説明" },
  { key: "place", label: "場所" },
  { key: "built_year", label: "建立年" },
  { key: "built_year_ce", label: "建立年(西暦)" },
  { key: "contributor", label: "投稿者" },
  { key: "created_at", label: "登録日" },
  { key: "photo_date", label: "撮影日" },
  { key: "project", label: "プロジェクト" },
  { key: "city_code", label: "市コード" },
  { key: "mesh_code", label: "メッシュコード" },
  { key: "image", label: "画像" },
];

function App() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>(
    localStorage.getItem(LOCAL_STORAGE_SEARCH_KEY) || "",
  );
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>(
    localStorage.getItem(LOCAL_STORAGE_SEARCH_KEY) || "",
  );

  // Debounce searchTerm updates to avoid frequent filtering
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(id);
  }, [searchTerm]);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  useEffect(() => {
    fetchFeatures();
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_SEARCH_KEY, searchTerm);
  }, [searchTerm]);

  const fetchFeatures = async () => {
    try {
      const response = await fetch("./stone_db.geojson");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Load per-user progress from localStorage
      const storedProgress = JSON.parse(
        localStorage.getItem(LOCAL_STORAGE_PROGRESS_KEY) || "{}",
      ) as Record<string, unknown>;

      const normalizeFeature = (raw: unknown, index: number): Feature => {
        const obj = raw as any;
        const id: string =
          (obj.properties && obj.properties.id) || obj.id || `feature-${index}`;
        const geometry =
          obj.geometry && Array.isArray(obj.geometry.coordinates)
            ? {
                type: obj.geometry.type || "Point",
                coordinates: obj.geometry.coordinates,
              }
            : { type: "Point", coordinates: [0, 0] };
        const propsObj =
          obj.properties && typeof obj.properties === "object"
            ? obj.properties
            : {};
        const rawStatus = storedProgress[id] ?? propsObj.verificationStatus;
        const verificationStatus = isStatus(rawStatus) ? rawStatus : "pending";
        const properties: FeatureProperties = {
          ...propsObj,
          verificationStatus,
        } as FeatureProperties;
        return {
          id,
          type: obj.type || "Feature",
          geometry,
          properties,
        };
      };

      const featuresWithLocalStatus = Array.isArray(data.features)
        ? data.features.map((f: unknown, i: number) => normalizeFeature(f, i))
        : [];

      setFeatures(featuresWithLocalStatus);
    } catch (err) {
      setError("Failed to fetch features.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateFeatureStatus = async (
    id: string | number,
    status: "pending" | "verified",
  ) => {
    // Store status locally in localStorage (per-user)
    try {
      const stored = JSON.parse(
        localStorage.getItem(LOCAL_STORAGE_PROGRESS_KEY) || "{}",
      );
      stored[String(id)] = status;
      localStorage.setItem(LOCAL_STORAGE_PROGRESS_KEY, JSON.stringify(stored));

      // create updated features synchronously to determine new filtered set
      const updatedFeatures = features.map((feature) =>
        String(feature.id) === String(id)
          ? {
              ...feature,
              properties: { ...feature.properties, verificationStatus: status },
            }
          : feature,
      );

      // apply updated features state
      setFeatures(updatedFeatures);

      const prevSelectedId = selectedFeature?.id;

      // compute new filtered list after update
      const newFiltered = updatedFeatures.filter((f) =>
        matchFeatureFromQuery(searchTerm.trim(), f),
      );

      if (prevSelectedId) {
        // if previously selected still visible, update its status in selection
        if (newFiltered.some((f) => String(f.id) === String(prevSelectedId))) {
          if (selectedFeature && String(selectedFeature.id) === String(id)) {
            setSelectedFeature((prev) =>
              prev
                ? {
                    ...prev,
                    properties: {
                      ...prev.properties,
                      verificationStatus: status,
                    },
                  }
                : null,
            );
          }
        } else {
          // find next visible feature based on previous filtered order
          const prevFiltered = filteredFeatures;
          const idx = prevFiltered.findIndex(
            (f) => String(f.id) === String(prevSelectedId),
          );
          let chosen: Feature | null = null;
          if (idx >= 0) {
            for (let j = idx + 1; j < prevFiltered.length; j++) {
              const candidateId = prevFiltered[j].id;
              const found = newFiltered.find(
                (nf) => String(nf.id) === String(candidateId),
              );
              if (found) {
                chosen = found;
                break;
              }
            }
            if (!chosen) {
              for (let j = idx - 1; j >= 0; j--) {
                const candidateId = prevFiltered[j].id;
                const found = newFiltered.find(
                  (nf) => String(nf.id) === String(candidateId),
                );
                if (found) {
                  chosen = found;
                  break;
                }
              }
            }
          }
          setSelectedFeature(chosen || null);
        }
      }
    } catch (err) {
      setError("Failed to update status locally.");
      console.error(err);
    }
  };

  const copyCoordinatesToClipboard = async (
    latitude: number,
    longitude: number,
  ) => {
    const coordinatesString = `${latitude},${longitude}`;
    try {
      await navigator.clipboard.writeText(coordinatesString);
      setCopyFeedback("座標をコピーしました！");
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      console.error("Failed to copy coordinates: ", err);
      setCopyFeedback("座標のコピーに失敗しました。");
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  const copyFeaturePropertiesToClipboard = async (
    properties: FeatureProperties,
  ) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(properties, null, 2));
      setCopyFeedback("Feature JSON (properties) をコピーしました！");
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      console.error("Failed to copy feature properties JSON: ", err);
      setCopyFeedback("Feature JSON (properties) のコピーに失敗しました。");
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  // Import / Export handlers
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importCandidate, setImportCandidate] = useState<Record<
    string,
    string
  > | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const exportProgress = () => {
    const stored = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_PROGRESS_KEY) || "{}",
    );
    const blob = new Blob([JSON.stringify(stored, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "verification_progress.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const triggerImportDialog = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || "{}"));
        if (typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Invalid format");
        }
        const existing = JSON.parse(
          localStorage.getItem(LOCAL_STORAGE_PROGRESS_KEY) || "{}",
        );
        const hasExisting = existing && Object.keys(existing).length > 0;
        if (hasExisting) {
          setImportCandidate(parsed as Record<string, string>);
          setShowImportDialog(true);
        } else {
          localStorage.setItem(
            LOCAL_STORAGE_PROGRESS_KEY,
            JSON.stringify(parsed),
          );
          setFeatures((prev) =>
            (prev || []).map((feature) => {
              const key = String(feature.id);
              const raw = (parsed as Record<string, string>)[key];
              const vs: "verified" | "pending" =
                raw === "verified" ? "verified" : "pending";
              return {
                ...feature,
                properties: {
                  ...feature.properties,
                  verificationStatus: vs,
                },
              };
            }),
          );
        }
      } catch (err) {
        console.error("Failed to import progress file:", err);
        setError("インポートに失敗しました：ファイル形式を確認してください");
      }
    };
    reader.readAsText(file);
    // reset input so same file can be selected again later
    e.currentTarget.value = "";
  };

  const applyImport = (mode: "merge" | "overwrite") => {
    if (!importCandidate) return;
    const existing = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_PROGRESS_KEY) || "{}",
    );
    let result: Record<string, string>;
    if (mode === "merge") {
      result = { ...(existing || {}), ...importCandidate };
    } else {
      result = { ...importCandidate };
    }
    localStorage.setItem(LOCAL_STORAGE_PROGRESS_KEY, JSON.stringify(result));
    setFeatures((prev) =>
      (prev || []).map((feature) => {
        const key = String(feature.id);
        const raw = result[key];
        const vs: "verified" | "pending" =
          raw === "verified" ? "verified" : "pending";
        return {
          ...feature,
          properties: {
            ...feature.properties,
            verificationStatus: vs,
          },
        };
      }),
    );
    setImportCandidate(null);
    setShowImportDialog(false);
  };

  const cancelImport = () => {
    setImportCandidate(null);
    setShowImportDialog(false);
  };

  const filteredFeatures = useMemo(() => {
    const q = debouncedSearchTerm.trim();
    if (!q) return features;
    return features.filter((f) => matchFeatureFromQuery(q, f));
  }, [features, debouncedSearchTerm]);

  const latestFeatureTime = useMemo(() => {
    if (!features || features.length === 0) return null;
    // prefer properties.created_at, fallback to photo_date
    const times = features
      .map((f) => f.properties?.created_at || f.properties?.photo_date)
      .filter(Boolean)
      .map((s) => {
        const d = new Date(String(s));
        return isNaN(d.getTime()) ? null : d;
      })
      .filter((d) => d != null) as Date[];
    if (times.length === 0) return null;
    const latest = times.reduce((a, b) => (a > b ? a : b));
    return latest.toISOString();
  }, [features]);

  const { verifiedCount, pendingCount } = useMemo(() => {
    const counts = { verifiedCount: 0, pendingCount: 0 };
    filteredFeatures.forEach((feature) => {
      if (feature.properties.verificationStatus === "verified") {
        counts.verifiedCount++;
      } else {
        counts.pendingCount++;
      }
    });
    return counts;
  }, [filteredFeatures]);

  const FeatureRow = ({
    index,
    style,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => {
    const feature = filteredFeatures[index];
    if (!feature) return null;

    const isSelected = selectedFeature?.id === feature.id;

    const handleFeatureClick = () => {
      setSelectedFeature(feature);
    };

    const handleStatusToggle = () => {
      const newStatus =
        feature.properties.verificationStatus === "verified"
          ? "pending"
          : "verified";
      updateFeatureStatus(String(feature.id), newStatus);
    };

    const toggleButtonText =
      feature.properties.verificationStatus === "verified" ? "完了" : "未完了";

    return (
      <div className="feature-card-wrapper" style={style}>
        <div
          className={`feature-card ${isSelected ? "selected" : ""}`}
          onClick={handleFeatureClick}
        >
          <div className="card-header-line">
            {" "}
            {/* Wrapper for the header line */}
            <p className="actions status-actions">
              {" "}
              {/* Toggle button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusToggle();
                }}
                className={
                  feature.properties.verificationStatus === "verified"
                    ? "status-verified"
                    : "status-pending"
                }
              >
                {toggleButtonText}
              </button>
            </p>
            <p className="feature-list-meta">
              {" "}
              {/* Combined ID, Type, Address */}
              {feature.id} |{" "}
              {Array.isArray(feature.properties?.type)
                ? feature.properties.type.join(", ")
                : "N/A"}{" "}
              | {feature.properties?.address || "N/A"}
            </p>
          </div>
          {/* The h3 with name/id is removed as requested. */}
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

  const mapUrl =
    selectedFeature &&
    selectedFeature.geometry &&
    selectedFeature.geometry.type === "Point"
      ? `https://maps.google.com/maps?q=${selectedFeature.geometry.coordinates[1]},${selectedFeature.geometry.coordinates[0]}&output=embed&t=h`
      : "";

  return (
    <div className="app-container">
      <h1>石のデータベース検証</h1>
      <div className="app-meta">
        <small>Version: {VERSION}</small>
        <br />
        <small>
          Latest feature:{" "}
          {latestFeatureTime
            ? new Date(latestFeatureTime).toLocaleString()
            : "N/A"}
        </small>
      </div>
      <div className="filter-section">
        <input
          type="text"
          placeholder="地物をフィルタ (例: 東京都 神社 @未完了)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <div className="import-export-controls">
          <button onClick={exportProgress} className="export-button">
            エクスポート
          </button>
          <button onClick={triggerImportDialog} className="import-button">
            インポート
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={handleImportFile}
          />
        </div>
        {showImportDialog && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
            }}
          >
            <div
              style={{
                background: "#fff",
                padding: 20,
                borderRadius: 8,
                width: 420,
                boxShadow: "0 6px 24px rgba(0,0,0,0.3)",
              }}
            >
              <h3>既存の進捗データが見つかりました</h3>
              <p>インポート方法を選択してください。</p>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 12,
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => cancelImport()}
                  style={{ padding: "6px 10px" }}
                >
                  キャンセル
                </button>
                <button
                  onClick={() => applyImport("merge")}
                  style={{ padding: "6px 10px" }}
                >
                  マージ（既存を保持しつつ上書き）
                </button>
                <button
                  onClick={() => applyImport("overwrite")}
                  style={{ padding: "6px 10px" }}
                >
                  全て上書き
                </button>
              </div>
            </div>
          </div>
        )}
        <p className="feature-count">
          表示中のFeature数: {filteredFeatures.length} / 全Feature数:{" "}
          {features.length}
          (完了: <span className="status-verified">{verifiedCount}</span>,
          未完了: <span className="status-pending">{pendingCount}</span>)
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
              width={"100%"}
            >
              {FeatureRow}
            </FixedSizeList>
          </div>
        </div>

        <div className="details-section">
          {selectedFeature ? (
            <div className="feature-details-panel">
              <h2>
                {selectedFeature.properties?.name ||
                  `Feature ${selectedFeature.id}`}
              </h2>
              <p>
                <strong>Status:</strong>{" "}
                <span
                  className={`status-${selectedFeature.properties.verificationStatus}`}
                >
                  {selectedFeature.properties.verificationStatus === "verified"
                    ? "完了"
                    : "未完了"}
                </span>
              </p>

              {DETAIL_PROPERTIES.map((prop) => {
                const value = selectedFeature.properties[prop.key];
                if (value !== undefined && value !== null && value !== "") {
                  let displayValue: React.ReactNode;
                  if (Array.isArray(value)) {
                    displayValue = value.join(", ");
                  } else if (prop.key === "image") {
                    if (Array.isArray(value)) {
                      displayValue = value.length > 0 ? "あり" : "なし";
                    } else {
                      displayValue = String(value);
                    }
                  } else {
                    displayValue = String(value);
                  }
                  return (
                    <p key={prop.key}>
                      <strong>{prop.label}:</strong> {displayValue}
                    </p>
                  );
                }
                return null;
              })}

              {selectedFeature.geometry &&
                selectedFeature.geometry.type === "Point" && (
                  <p
                    className="coordinates-display"
                    onClick={() =>
                      copyCoordinatesToClipboard(
                        selectedFeature.geometry.coordinates[1],
                        selectedFeature.geometry.coordinates[0],
                      )
                    }
                  >
                    <strong>Coordinates:</strong>{" "}
                    {selectedFeature.geometry.coordinates[1]},{" "}
                    {selectedFeature.geometry.coordinates[0]} (クリックでコピー)
                  </p>
                )}

              <div className="actions">
                <button
                  onClick={() =>
                    copyFeaturePropertiesToClipboard(selectedFeature.properties)
                  }
                  className="copy-json-button"
                >
                  JSONをコピー
                </button>
              </div>

              {selectedFeature.geometry &&
                selectedFeature.geometry.type === "Point" && (
                  <div className="map-embed-container">
                    <h3>地図</h3>
                    <a
                      href={`http://maps.google.com/maps?q=loc:${selectedFeature.geometry.coordinates[1]}+${selectedFeature.geometry.coordinates[0]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="external-map-link-button"
                    >
                      Googleマップで開く
                    </a>
                    <a
                      href={`https://archives.sekibutsu.info/${selectedFeature.id}.html`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="external-map-link-button"
                    >
                      みんなで石仏調査
                    </a>
                    <iframe
                      src={mapUrl}
                      width="100%"
                      height="300"
                      style={{ border: 0, marginTop: "10px" }}
                      allowFullScreen={false}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    ></iframe>
                  </div>
                )}
            </div>
          ) : (
            <p className="select-feature-message">
              地物を選択すると詳細が表示されます。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
