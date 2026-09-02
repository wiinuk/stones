import { describe, it, expect } from "vitest";
import { tokenize, parse, matchFeatureFromQuery } from "./query";

type AstNode = {
  type: string;
  nodes?: AstNode[];
  node?: AstNode;
  value?: string;
  name?: string;
};

const asAstNode = (value: unknown): AstNode => value as AstNode;

describe("tokenize", () => {
  it("splits words and @", () => {
    expect(tokenize("東京 @confirmed test")).toEqual([
      "東京",
      "@",
      "confirmed",
      "test",
    ]);
    // fullwidth ＠ should be recognized the same way
    expect(tokenize("東京 ＠confirmed test")).toEqual([
      "東京",
      "＠",
      "confirmed",
      "test",
    ]);
  });

  it("splits fullwidth parentheses and hyphen", () => {
    expect(tokenize("（東京 横浜）")).toEqual(["（", "東京", "横浜", "）"]);
    expect(tokenize("－横浜")).toEqual(["－", "横浜"]);
  });
});

describe("parse", () => {
  it("parses Var and Word and Seq", () => {
    const ast = parse("東京 @confirmed");
    expect(ast.type).toBe("Seq");
    expect(asAstNode(ast).nodes?.[1]?.type).toBe("Var");

    const ast2 = parse("東京 ＠confirmed");
    expect(asAstNode(ast2).nodes?.[1]?.type).toBe("Var");
  });

  it("parses negative terms", () => {
    const ast = parse("-横浜");
    expect(ast.type).toBe("Not");
    expect(asAstNode(ast).node?.type).toBe("Word");
    expect(asAstNode(ast).node?.value).toBe("横浜");

    const ast2 = parse("-@confirmed");
    expect(ast2.type).toBe("Not");
    expect(asAstNode(ast2).node?.type).toBe("Var");
    expect(asAstNode(ast2).node?.name).toBe("confirmed");
  });

  it("parses grouped expressions", () => {
    const ast = parse("(東京 横浜)");
    expect(ast.type).toBe("Seq");
    expect(asAstNode(ast).nodes?.[0]?.type).toBe("Word");
    expect(asAstNode(ast).nodes?.[1]?.type).toBe("Word");

    const ast2 = parse("東京 -(横浜 日枝)");
    expect(ast2.type).toBe("Seq");
    expect(asAstNode(ast2).nodes?.[1]?.type).toBe("Not");
    expect(asAstNode(asAstNode(ast2).nodes?.[1])?.node?.type).toBe("Seq");

    const ast3 = parse("（東京 横浜）");
    expect(ast3.type).toBe("Seq");
    expect(asAstNode(ast3).nodes?.[0]?.type).toBe("Word");
    expect(asAstNode(ast3).nodes?.[1]?.type).toBe("Word");

    const ast4 = parse("東京 －(横浜 日枝）");
    expect(ast4.type).toBe("Seq");
    expect(asAstNode(ast4).nodes?.[1]?.type).toBe("Not");
    expect(asAstNode(asAstNode(ast4).nodes?.[1])?.node?.type).toBe("Seq");
  });

  it("parses OR expressions", () => {
    const ast = parse("東京|横浜");
    expect(ast.type).toBe("Or");
    expect(asAstNode(ast).nodes?.length).toBe(2);
    expect(asAstNode(ast).nodes?.[0]?.type).toBe("Word");
    expect(asAstNode(ast).nodes?.[1]?.type).toBe("Word");

    const ast2 = parse("東京 ｜横浜");
    expect(ast2.type).toBe("Or");
    expect(asAstNode(ast2).nodes?.length).toBe(2);
  });

  it("parses inverted OR groups correctly", () => {
    const ast = parse("NotMatchWord (NotMatchWord | 東京都)");
    expect(ast.type).toBe("Seq");
    expect(asAstNode(ast).nodes?.length).toBe(2);
    expect(asAstNode(ast).nodes?.[0]?.type).toBe("Word");
    expect(asAstNode(ast).nodes?.[1]?.type).toBe("Or");

    const ast2 = parse("NotMatchWord (東京都 | NotMatchWord)");
    expect(ast2.type).toBe("Seq");
    expect(asAstNode(ast2).nodes?.[1]?.type).toBe("Or");
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

const numericIdFeature = {
  id: 123,
  properties: {
    name: "数値IDの石",
    place: "東京都",
    verificationStatus: "verified",
  },
};

const noIdFeature = {
  properties: {
    name: "IDなしの石",
    place: "神奈川県",
    verificationStatus: "pending",
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
    // fullwidth marker variants
    expect(matchFeatureFromQuery("＠confirmed", sampleFeature)).toBe(true);
    expect(matchFeatureFromQuery("＠pending", sampleFeature)).toBe(false);
  });

  it("ANDs tokens in sequence", () => {
    expect(matchFeatureFromQuery("日枝 東京都", sampleFeature)).toBe(true);
    expect(matchFeatureFromQuery("日枝 横浜", sampleFeature)).toBe(false);
  });

  it("supports negative tokens", () => {
    expect(matchFeatureFromQuery("東京都 -横浜", sampleFeature)).toBe(true);
    expect(matchFeatureFromQuery("東京都 -東京都", sampleFeature)).toBe(false);
    expect(matchFeatureFromQuery("-@confirmed", sampleFeature)).toBe(false);
    expect(matchFeatureFromQuery("-@pending", sampleFeature)).toBe(true);
  });

  it("supports OR matching", () => {
    expect(matchFeatureFromQuery("横浜|東京都", sampleFeature)).toBe(true);
    expect(matchFeatureFromQuery("横浜｜大阪", sampleFeature)).toBe(false);
    expect(matchFeatureFromQuery("横浜｜東京都", sampleFeature)).toBe(true);
  });

  it("supports numeric id features and features without id", () => {
    expect(matchFeatureFromQuery("数値ID", numericIdFeature)).toBe(true);
    expect(matchFeatureFromQuery("IDなし", noIdFeature)).toBe(true);
    // ensure non-matching still returns false
    expect(matchFeatureFromQuery("横浜", numericIdFeature)).toBe(false);
  });
});
