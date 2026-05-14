/**
 * Post-processes sdk.gen.ts to add:
 * 1. Explicit return type annotations (fixes JSR slow types)
 * 2. JSDoc comments (fixes JSR docs score)
 *
 * Runs after @hey-api/openapi-ts, before prettier/eslint.
 * Zero dependencies — uses only Node.js built-ins.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// --- Load inputs ---

const sdkPath = resolve(ROOT, "src/client/sdk.gen.ts");
const specPath = resolve(ROOT, "spec/openapi.oas.json");

let sdk = readFileSync(sdkPath, "utf-8");
const spec = JSON.parse(readFileSync(specPath, "utf-8"));

// --- Build operation map from spec ---

/** @type {Map<string, { method: string, path: string }>} */
const operationMap = new Map();

for (const [path, methods] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(methods)) {
    if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
    if (op.deprecated) continue;
    operationMap.set(op.operationId, { method: method.toUpperCase(), path });
  }
}

// --- Helpers ---

/** Convert operationId to generated function name (camelCase join). */
function toFunctionName(operationId) {
  return operationId
    .split("_")
    .map((part, i) => (i === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join("");
}

/** Insert spaces before capitals in camelCase: "appStoreVersions" → "app store versions" */
function humanize(camel) {
  return camel
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase();
}

/** Pick "a" or "an" for a PascalCase identifier based on its first sound. */
function article(name) {
  return /^[AEIOU]/.test(name) ? "an" : "a";
}

/** Generate JSDoc description from operationId parts. */
function generateDoc(operationId, method, path) {
  const parts = operationId.split("_");
  const action = parts[parts.length - 1];
  const resource = humanize(parts[0]);

  // For relational operations, the relation is the middle segment(s)
  const relation =
    parts.length > 2 ? humanize(parts.slice(1, -1).join("")) : null;

  const templates = {
    createInstance: `Create ${resource}.`,
    getInstance: `Read ${resource}.`,
    getCollection: `List ${resource}.`,
    updateInstance: `Update ${resource}.`,
    deleteInstance: `Delete ${resource}.`,
    getToManyRelated: `List related ${relation} for ${resource}.`,
    getToOneRelated: `Read related ${relation} for ${resource}.`,
    getToManyRelationship: `Get ${relation} relationship IDs for ${resource}.`,
    getToOneRelationship: `Get ${relation} relationship ID for ${resource}.`,
    createToManyRelationship: `Add ${relation} relationship for ${resource}.`,
    deleteToManyRelationship: `Remove ${relation} relationship for ${resource}.`,
    replaceToManyRelationship: `Replace ${relation} relationships for ${resource}.`,
    updateToOneRelationship: `Update ${relation} relationship for ${resource}.`,
    getMetrics: `Get ${relation} metrics for ${resource}.`,
  };

  let description = templates[action] || `${method} ${path}`;
  if (description.includes("null")) {
    description = `${method} ${path}`;
  }
  return `/** ${description} \`${method} ${path}\` */`;
}

// --- Add RequestResult import ---

sdk = sdk.replace(
  /import type \{([^}]*)\} from "\.\/client\/index\.js";/s,
  (match, imports) => {
    if (imports.includes("RequestResult")) return match;
    const items = imports
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    items.push("RequestResult");
    items.sort((a, b) => {
      // Sort by the actual type name (handle "Options as Options2" → sort by "Options")
      const nameA = a.split(" ")[0];
      const nameB = b.split(" ")[0];
      return nameA.localeCompare(nameB);
    });
    return `import type {\n  ${items.join(",\n  ")},\n} from "./client/index.js";`;
  },
);

// --- Annotate functions ---

// Regex matches each exported function and captures name + response/error generics.
// Three formatting variants (from prettier wrapping at different line lengths):
//   1. `export const foo = <ThrowOnError...>(\n  options:` (short name)
//   2. `export const foo = <\n  ThrowOnError...,\n>(\n  options:` (medium name)
//   3. `export const foo =\n  <ThrowOnError...>(\n    options:` (long name, wrapped)
// All whitespace between structural markers is flexible (\s*).
const FN_REGEX =
  /(?<jsdoc>\/\*\*[^]*?\*\/\n)?export const (?<name>\w+) =\s*<\s*ThrowOnError extends boolean = false,?\s*>?\(\s*(?<params>options\??\s*:\s*Options<[\s\S]*?>)\s*,?\s*\) =>\s*\(options\??\s*\.\s*client \?\? client\)\.\w+<\s*(?<responses>\w+),\s*(?<errors>\w+),\s*ThrowOnError,?\s*>/gm;

// Build function name → spec lookup
const fnToSpec = new Map();
for (const [opId, info] of operationMap) {
  fnToSpec.set(toFunctionName(opId), { opId, ...info });
}

let processed = 0;

sdk = sdk.replace(FN_REGEX, (match, ...args) => {
  const groups = args[args.length - 1]; // named groups are last arg
  const { name, responses, errors, jsdoc } = groups;

  // Idempotency: skip if already annotated
  if (match.includes("): RequestResult<")) return match;

  processed++;

  // Build JSDoc
  const specInfo = fnToSpec.get(name);
  const doc = specInfo
    ? generateDoc(specInfo.opId, specInfo.method, specInfo.path)
    : `/** ${name} */`;

  // Insert return type: replace `) =>\n` with `): RequestResult<R, E, ThrowOnError> =>\n`
  let annotated = match.replace(
    /\) =>\n/,
    `): RequestResult<${responses}, ${errors}, ThrowOnError> =>\n`,
  );

  // Remove existing JSDoc if present, then prepend new one
  if (jsdoc) {
    annotated = annotated.slice(jsdoc.length);
  }
  annotated = doc + "\n" + annotated;

  return annotated;
});

// --- Drift assertion ---

// Count all exported arrow functions (handles `= <` on same line or wrapped to next)
const totalFunctions =
  (sdk.match(/^export const \w+ =\s*$/gm) || []).length +
  (sdk.match(/^export const \w+ = </gm) || []).length;

if (processed === 0) {
  console.error(
    "ERROR: No functions were annotated. Has the generator output format changed?",
  );
  process.exit(1);
}

if (processed !== totalFunctions) {
  console.error(
    `ERROR: Annotated ${processed} functions but found ${totalFunctions} in sdk.gen.ts. ` +
      `${totalFunctions - processed} functions were not matched by the regex.`,
  );
  process.exit(1);
}

// --- Annotate types.gen.ts (add JSDoc to every exported type) ---

const typesPath = resolve(ROOT, "src/client/types.gen.ts");
let typesFile = readFileSync(typesPath, "utf-8");

// Operation function names in PascalCase → spec info, used to detect
// operation-level types like `AppsCreateInstanceData`.
const opPascalToSpec = new Map();
for (const [opId, info] of operationMap) {
  const camel = toFunctionName(opId);
  const pascal = camel[0].toUpperCase() + camel.slice(1);
  opPascalToSpec.set(pascal, { opId, ...info });
}

const OP_VERBS = {
  Data: "Request options for",
  Response: "Successful response from",
  Responses: "Response status map for",
  Error: "Error response from",
  Errors: "Error status map for",
};

// Order matters: longer/more-specific suffixes first so e.g. `Errors` is
// tried before `Error`, and `WithoutIncludesResponse` before `Response`.
const RESOURCE_SUFFIXES = [
  ["WithoutIncludesResponse", "Response (without included resources) for"],
  ["LinkagesResponse", "Linkage response for"],
  ["LinkageResponse", "Linkage response for"],
  ["LinkagesRequest", "Linkage request body for"],
  ["LinkageRequest", "Linkage request body for"],
  ["CreateRequest", "Request body for creating"],
  ["UpdateRequest", "Request body for updating"],
  ["InlineCreate", "Inline create payload for"],
  ["InlineUpdate", "Inline update payload for"],
  ["Attributes", "Attributes of"],
  ["Relationships", "Relationships of"],
  ["Response", "Response containing"],
];

function generateTypeDoc(typeName) {
  // Operation-level type? Suffix attached to a known operation function name.
  for (const [suffix, prefix] of Object.entries(OP_VERBS).sort(
    (a, b) => b[0].length - a[0].length,
  )) {
    if (!typeName.endsWith(suffix)) continue;
    const base = typeName.slice(0, -suffix.length);
    const op = opPascalToSpec.get(base);
    if (op) return `${prefix} \`${op.method} ${op.path}\`.`;
  }

  // Resource-level type with a known suffix.
  for (const [suffix, prefix] of RESOURCE_SUFFIXES) {
    if (!typeName.endsWith(suffix)) continue;
    const base = typeName.slice(0, -suffix.length);
    if (!base) continue;
    return `${prefix} ${article(base)} ${humanize(base)}.`;
  }

  // Fallback: humanized name.
  return `${humanize(typeName)}.`;
}

// Match an `export type X = ...` declaration, optionally preceded by a
// single JSDoc block. Capturing groups: existing JSDoc (or empty) + name.
const TYPE_REGEX =
  /(\/\*\*[^]*?\*\/\n)?(export type ([A-Za-z][A-Za-z0-9]*) =)/g;

// Existing JSDoc bodies that are just the type name (Hey API's default) are
// treated as "empty" and overwritten. Anything richer is preserved.
function isPlaceholderDoc(jsdoc, typeName) {
  if (!jsdoc) return true;
  const body = jsdoc
    .replace(/\/\*\*|\*\//g, "")
    .replace(/^\s*\*\s?/gm, "")
    .trim();
  return body === "" || body === typeName;
}

let typesAnnotated = 0;
let typesPreserved = 0;

typesFile = typesFile.replace(TYPE_REGEX, (match, jsdoc, decl, typeName) => {
  if (!isPlaceholderDoc(jsdoc, typeName)) {
    typesPreserved++;
    return match;
  }
  typesAnnotated++;
  const doc = `/** ${generateTypeDoc(typeName)} */\n`;
  return doc + decl;
});

writeFileSync(typesPath, typesFile);

// --- Annotate client.gen.ts (add explicit Client type to the client export) ---

const clientPath = resolve(ROOT, "src/client/client.gen.ts");
let clientFile = readFileSync(clientPath, "utf-8");

if (!clientFile.includes("export const client: Client")) {
  // Add Client to imports
  if (
    !clientFile.includes("type Client,") &&
    !clientFile.includes("type Client }")
  ) {
    clientFile = clientFile.replace(
      "type ClientOptions,",
      "type Client,\n  type ClientOptions,",
    );
  }
  // Add type annotation
  clientFile = clientFile.replace(
    "export const client = createClient(",
    "export const client: Client = createClient(",
  );
  writeFileSync(clientPath, clientFile);
}

// --- Write output ---

writeFileSync(sdkPath, sdk);
console.log(
  `Annotated ${processed} functions in sdk.gen.ts, ` +
    `${typesAnnotated} types in types.gen.ts ` +
    `(${typesPreserved} preserved).`,
);
