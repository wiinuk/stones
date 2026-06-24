import { isFeature } from "../types";

export type Node = WordNode | VarNode | SeqNode | NotNode;

export type WordNode = { type: "Word"; value: string };
export type VarNode = { type: "Var"; name: string };
export type SeqNode = { type: "Seq"; nodes: Node[] };
export type NotNode = { type: "Not"; node: WordNode | VarNode };

// Tokenize: split into '@' tokens and words (non-space, non-@ sequences)
export function tokenize(query: string): string[] {
  const tokens: string[] = [];
  // accept ASCII @ and fullwidth ＠ (U+FF20)
  const re = /@|＠|[^@\s＠]+/g;
  let m;
  while ((m = re.exec(query)) !== null) {
    tokens.push(m[0]);
  }
  return tokens;
}

// Parse tokens into AST: Var when '@' followed by word, otherwise Word nodes.
export function parse(tokens: string[] | string): Node {
  const toks = typeof tokens === "string" ? tokenize(tokens) : tokens;
  const nodes: Node[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];

    const parseWord = (value: string): WordNode => ({ type: "Word", value });
    const parseVar = (name: string): VarNode => ({ type: "Var", name });
    const parseNegated = (node: WordNode | VarNode): NotNode => ({
      type: "Not",
      node,
    });

    if (t === "@" || t === "＠") {
      const next = toks[i + 1];
      if (next && next !== "@") {
        nodes.push(parseVar(next));
        i += 1; // consume next
      } else {
        // stray @ treated as Word
        nodes.push(parseWord(t));
      }
      continue;
    }

    if (t === "-") {
      const next = toks[i + 1];
      if (next) {
        if (next === "@" || next === "＠") {
          const nextVar = toks[i + 2];
          if (nextVar && nextVar !== "@") {
            nodes.push(parseNegated(parseVar(nextVar)));
            i += 2;
            continue;
          }
        } else {
          nodes.push(parseNegated(parseWord(next)));
          i += 1;
          continue;
        }
      }
      nodes.push(parseWord(t));
      continue;
    }

    if (t.startsWith("-") && t.length > 1) {
      const value = t.slice(1);
      if (value === "@" || value === "＠") {
        const nextVar = toks[i + 1];
        if (nextVar && nextVar !== "@") {
          nodes.push(parseNegated(parseVar(nextVar)));
          i += 1;
          continue;
        }
      }
      nodes.push(parseNegated(parseWord(value)));
      continue;
    }

    nodes.push(parseWord(t));
  }

  if (nodes.length === 0) return { type: "Seq", nodes: [] };
  if (nodes.length === 1) return nodes[0];
  return { type: "Seq", nodes };
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
