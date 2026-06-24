import { isFeature } from "../types";

export type Node = WordNode | VarNode | SeqNode | NotNode;

export type WordNode = { type: "Word"; value: string };
export type VarNode = { type: "Var"; name: string };
export type SeqNode = { type: "Seq"; nodes: Node[] };
export type NotNode = { type: "Not"; node: Node };

// Tokenize: split into '@' tokens, parentheses, and words (non-space, non-@ sequences)
export function tokenize(query: string): string[] {
  const tokens: string[] = [];
  // accept ASCII @ and fullwidth ＠ (U+FF20)
  const re = /@|＠|\(|\)|[^@\s＠()]+/g;
  let m;
  while ((m = re.exec(query)) !== null) {
    tokens.push(m[0]);
  }
  return tokens;
}

function parseSequence(tokens: string[], start = 0): [Node, number] {
  const nodes: Node[] = [];
  let i = start;

  const parseWord = (value: string): WordNode => ({ type: "Word", value });
  const parseVar = (name: string): VarNode => ({ type: "Var", name });
  const parseNegated = (node: Node): NotNode => ({ type: "Not", node });

  const parseSingle = (token: string): [Node, number] => {
    if (token === "@" || token === "＠") {
      const next = tokens[i + 1];
      if (next && next !== "@" && next !== "＠" && next !== ")") {
        i += 2;
        return [parseVar(next), i];
      }
      i += 1;
      return [parseWord(token), i];
    }

    if (token === "-") {
      const next = tokens[i + 1];
      if (next) {
        if (next === "@" || next === "＠") {
          const nextVar = tokens[i + 2];
          if (nextVar && nextVar !== "@" && nextVar !== "＠") {
            i += 3;
            return [parseNegated(parseVar(nextVar)), i];
          }
        }
        if (next === "(") {
          i += 2;
          const [node, nextIndex] = parseSequence(tokens, i);
          i = nextIndex;
          if (tokens[i] === ")") i += 1;
          return [parseNegated(node), i];
        }
        i += 2;
        return [parseNegated(parseWord(next)), i];
      }
      i += 1;
      return [parseWord(token), i];
    }

    if (token.startsWith("-") && token.length > 1) {
      const value = token.slice(1);
      if (value === "@" || value === "＠") {
        const nextVar = tokens[i + 1];
        if (nextVar && nextVar !== "@" && nextVar !== "＠") {
          i += 2;
          return [parseNegated(parseVar(nextVar)), i];
        }
      }
      if (value === "(") {
        i += 1;
        const [node, nextIndex] = parseSequence(tokens, i);
        i = nextIndex;
        if (tokens[i] === ")") i += 1;
        return [parseNegated(node), i];
      }
      i += 1;
      return [parseNegated(parseWord(value)), i];
    }

    if (token === "(") {
      i += 1;
      const [node, nextIndex] = parseSequence(tokens, i);
      i = nextIndex;
      if (tokens[i] === ")") i += 1;
      return [node, i];
    }

    i += 1;
    return [parseWord(token), i];
  };

  while (i < tokens.length) {
    const token = tokens[i];
    if (token === ")") break;
    const [node, nextIndex] = parseSingle(token);
    nodes.push(node);
    i = nextIndex;
  }

  if (nodes.length === 0) return [{ type: "Seq", nodes: [] }, i];
  if (nodes.length === 1) return [nodes[0], i];
  return [{ type: "Seq", nodes }, i];
}

export function parse(tokens: string[] | string): Node {
  const toks = typeof tokens === "string" ? tokenize(tokens) : tokens;
  const [node] = parseSequence(toks, 0);
  return node;
}

function normalizeText(s: string): string {
  return s == null ? "" : String(s).toLowerCase();
}

// Evaluate AST against a feature. Default Word semantics: partial, case-insensitive match across all properties.
export function matchNode(node: Node, feature: unknown): boolean {
  if (!node) return true;
  if (!isFeature(feature)) return false;
  if (node.type === "Seq") {
    return node.nodes.every((n) => matchNode(n, feature));
  }
  if (node.type === "Not") {
    return !matchNode(node.node, feature);
  }
  if (node.type === "Word") {
    const term = normalizeText(node.value);
    // search in properties
    const props = feature.properties || {};
    for (const key of Object.keys(props)) {
      const val = props[key] as unknown;
      if (Array.isArray(val)) {
        for (const item of val) {
          if (normalizeText(String(item)).includes(term)) return true;
        }
      } else if (normalizeText(String(val)).includes(term)) {
        return true;
      }
    }
    // also check id
    if (feature.id && normalizeText(String(feature.id)).includes(term))
      return true;
    return false;
  }
  if (node.type === "Var") {
    const name = normalizeText(node.name);
    // support common status vars
    if (name === "confirmed" || name === "完了") {
      return (feature.properties?.verificationStatus || "") === "verified";
    }
    if (name === "pending" || name === "未完了") {
      return (feature.properties?.verificationStatus || "") === "pending";
    }
    // fallback: treat as Word
    return matchNode({ type: "Word", value: node.name }, feature);
  }
  return false;
}

export function matchFeatureFromQuery(
  query: string,
  feature: unknown,
): boolean {
  const ast = parse(query);
  return matchNode(ast, feature);
}
