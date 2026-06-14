export interface FeatureProperties {
  name?: string;
  description?: string;
  verificationStatus: "pending" | "verified";
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
  // allow additional properties but keep them unknown so callers must validate
  [key: string]: unknown;
}

export interface Feature {
  id: string;
  type: string;
  geometry: {
    type: string;
    coordinates: number[];
  };
  properties: FeatureProperties;
}

export const isStatus = (s: unknown): s is "pending" | "verified" =>
  s === "pending" || s === "verified";

export function isFeature(obj: unknown): obj is Feature {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as any;
  if (typeof o.id !== "string" && !(o.properties && o.properties.id))
    return false;
  if (!o.properties || typeof o.properties !== "object") return false;
  return true;
}
