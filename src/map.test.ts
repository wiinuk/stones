import { describe, expect, it } from "vitest";
import type { Feature } from "./types";
import { buildGoogleMapEmbedUrl, getFeatureMapKey } from "./map";

describe("map helpers", () => {
  it("creates a Google Maps embed URL from latitude and longitude", () => {
    expect(buildGoogleMapEmbedUrl(35.6812, 139.7671)).toBe(
      "https://maps.google.com/maps?q=35.6812,139.7671&output=embed&t=h",
    );
  });

  it("changes the iframe key when a different feature is selected", () => {
    const featureA: Feature = {
      id: "feature-1",
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [139.7671, 35.6812],
      },
      properties: {
        verificationStatus: "pending",
      },
    };

    const featureB: Feature = {
      ...featureA,
      id: "feature-2",
    };

    expect(getFeatureMapKey(featureA)).not.toBe(getFeatureMapKey(featureB));
  });
});
