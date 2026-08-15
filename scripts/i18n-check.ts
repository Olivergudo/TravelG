import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { es } from "../lib/i18n/locales/es";
import { en } from "../lib/i18n/locales/en";
import { fr } from "../lib/i18n/locales/fr";
import { de } from "../lib/i18n/locales/de";

const dictionaries = { es, en, fr, de } as const;
const reference = Object.keys(es).sort();
const errors: string[] = [];
const warnings: string[] = [];
for (const [locale, dictionary] of Object.entries(dictionaries)) {
  const keys = Object.keys(dictionary).sort();
  for (const key of reference.filter((value) => !keys.includes(value))) errors.push(`Missing translation: ${locale}.${key}`);
  for (const key of keys.filter((value) => !reference.includes(value))) errors.push(`Extra translation: ${locale}.${key}`);
}

const roots = ["app", "components"];
const visibleAttributes = new Set(["placeholder", "aria-label", "title", "alt"]);
const allowedVisibleLiterals = new Set(["Gasto Listo", "PRO", "Roomies", "PDF", "CLP", "MXN", "USD", "EUR", "•••", "←", "+", "✓"]);
const hasWords = (value: string) => /[A-Za-zÀ-ÿ]{2}/.test(value);
function files(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? files(target) : /\.tsx$/.test(entry.name) ? [target] : [];
  });
}
for (const file of roots.flatMap((root) => files(root))) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const report = (node: ts.Node, value: string) => {
    const clean = value.replace(/\s+/g, " ").trim();
    if (!hasWords(clean) || allowedVisibleLiterals.has(clean)) return;
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    warnings.push(`Hardcoded visible string: ${file}:${line} ${JSON.stringify(clean)}`);
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) report(node, node.text);
    if (ts.isJsxAttribute(node) && visibleAttributes.has(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)) report(node, node.initializer.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
if (warnings.length) console.warn(warnings.join("\n"));
console.log(`i18n keys OK: ${reference.length} keys across ${Object.keys(dictionaries).length} locales. JSX audit: ${warnings.length} warning(s).`);
