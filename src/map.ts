import type { Feature } from "./types";

export function buildGoogleMapEmbedUrl(latitude: number, longitude: number) {
  return `https://maps.google.com/maps?q=${latitude},${longitude}&output=embed&t=h`;
}

export function getFeatureMapKey(feature: Feature | null | undefined) {
  if (!feature || feature.geometry?.type !== "Point") {
    return `map:${feature?.id ?? "none"}`;
  }

  const [longitude, latitude] = feature.geometry.coordinates;
  return `map:${feature.id}:${latitude}:${longitude}`;
}
