import { describe, it, expect } from "vitest";
import { tokenize, parse, matchNode, matchFeatureFromQuery } from "./query";

describe("tokenize", () => {
  it("splits words and @", () => {
    expect(tokenize("東京 @confirmed test")).toEqual([
      "東京",
      "@",
      "confirmed",
      "test",
    ]);
  });
});

describe("parse", () => {
  it("parses Var and Word and Seq", () => {
    const ast = parse("東京 @confirmed");
    expect(ast.type).toBe("Seq");
    // @confirmed should be Var
    // @ts-ignore
    expect((ast as any).nodes[1].type).toBe("Var");
  });
});

const sampleFeature = {
  id: "feature-1",
  properties: {
    name: "日枝神社",
    place: "東京都",
    verificationStatus: "verified",
  },
};

describe("matching", () => {
  it("matches word tokens across properties", () => {
    expect(matchFeatureFromQuery("日枝", sampleFeature)).toBe(true);
    expect(matchFeatureFromQuery("横浜", sampleFeature)).toBe(false);
  });

  it("matches var tokens for confirmed/pending", () => {
    expect(matchFeatureFromQuery("@confirmed", sampleFeature)).toBe(true);
    expect(matchFeatureFromQuery("@pending", sampleFeature)).toBe(false);
  });

  it("ANDs tokens in sequence", () => {
    expect(matchFeatureFromQuery("日枝 東京都", sampleFeature)).toBe(true);
    expect(matchFeatureFromQuery("日枝 横浜", sampleFeature)).toBe(false);
  });
});
