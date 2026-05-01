/**
 * Parses a GitHub issue-form body (markdown produced by an issue template)
 * into a JSON job spec consumable by `scripts/change-request.ts`.
 *
 * Issue forms produce predictable markdown — each field becomes a
 * `### <Field label>` heading followed by the value (or `_No response_`
 * when left blank). This script reads the body from stdin, extracts the
 * known fields, normalises the scope dropdown to an enum, and emits the
 * spec on stdout.
 *
 *   echo "$ISSUE_BODY" | pnpm --silent parse-change-request \
 *     --requester willlamerton --issue-number 123
 *
 * Exits non-zero on missing required fields with a human-readable error
 * on stderr — the workflow surfaces that as a step failure.
 */

import { parseArgs } from "node:util";

type Scope = "whole-pack" | "channels" | "article" | "file";

type JobSpec = {
  product: string;
  version: string;
  scope: Scope;
  articleSlug: string | null;
  filePath: string | null;
  request: string;
  context: string | null;
  requester: string;
  issueNumber: number;
};

// Scope dropdown labels in the issue form → enum values used by the orchestrator.
const SCOPE_MAP: Record<string, Scope> = {
  "whole pack": "whole-pack",
  "headline channels (channels/*.md)": "channels",
  "specific article": "article",
  "specific file": "file",
};

// Issue-form field labels → JobSpec keys. Order is the section order in the
// rendered markdown; the parser tolerates any order in practice.
const FIELDS = {
  Product: "product",
  Version: "version",
  Scope: "scope",
  "Article slug": "articleSlug",
  "File path": "filePath",
  Request: "request",
  "Additional context": "context",
} as const;

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk as Buffer));
    process.stdin.on("end", () =>
      resolve(Buffer.concat(chunks).toString("utf8")),
    );
  });
}

/**
 * Walks the body line by line. When we hit `### <known-field>` we capture
 * everything until the next `###` heading or EOF, trim, and store. The
 * sentinel `_No response_` is mapped to null.
 */
function extractFields(body: string): Map<string, string | null> {
  const lines = body.split(/\r?\n/);
  const out = new Map<string, string | null>();
  let currentField: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentField === null) return;
    const raw = buffer.join("\n").trim();
    out.set(currentField, raw === "_No response_" || raw === "" ? null : raw);
  };

  for (const line of lines) {
    const heading = line.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      flush();
      const label = heading[1].trim();
      currentField =
        Object.keys(FIELDS).find(
          (k) => k.toLowerCase() === label.toLowerCase(),
        ) ?? null;
      buffer = [];
      continue;
    }
    if (currentField !== null) buffer.push(line);
  }
  flush();
  return out;
}

function buildJobSpec(args: {
  fields: Map<string, string | null>;
  requester: string;
  issueNumber: number;
}): JobSpec {
  const { fields, requester, issueNumber } = args;

  const required = (label: keyof typeof FIELDS): string => {
    const value = fields.get(label);
    if (!value) {
      console.error(`parse-change-request: required field missing: "${label}"`);
      process.exit(2);
    }
    return value;
  };

  const product = required("Product").toLowerCase();
  const version = required("Version").trim();
  const scopeLabel = required("Scope");
  const scope = SCOPE_MAP[scopeLabel.toLowerCase()];
  if (!scope) {
    console.error(
      `parse-change-request: unknown scope "${scopeLabel}"; expected one of: ${Object.keys(SCOPE_MAP).join(", ")}`,
    );
    process.exit(2);
  }

  const articleSlug = fields.get("Article slug") ?? null;
  const filePath = fields.get("File path") ?? null;
  const request = required("Request");
  const context = fields.get("Additional context") ?? null;

  // Cross-field validation that the orchestrator would otherwise hit later.
  if (scope === "article" && !articleSlug) {
    console.error(
      'parse-change-request: scope = "Specific article" requires an Article slug',
    );
    process.exit(2);
  }
  if (scope === "file" && !filePath) {
    console.error(
      'parse-change-request: scope = "Specific file" requires a File path',
    );
    process.exit(2);
  }

  return {
    product,
    version,
    scope,
    articleSlug,
    filePath,
    request,
    context,
    requester,
    issueNumber,
  };
}

async function main() {
  const { values } = parseArgs({
    allowPositionals: true,
    options: {
      requester: { type: "string" },
      "issue-number": { type: "string" },
    },
  });
  const requester = values.requester as string | undefined;
  const issueNumberRaw = values["issue-number"] as string | undefined;
  if (!requester || !issueNumberRaw) {
    console.error(
      "parse-change-request: --requester and --issue-number are required",
    );
    process.exit(2);
  }
  const issueNumber = Number.parseInt(issueNumberRaw, 10);
  if (!Number.isFinite(issueNumber)) {
    console.error(`parse-change-request: --issue-number must be an integer`);
    process.exit(2);
  }

  const body = await readStdin();
  if (!body.trim()) {
    console.error("parse-change-request: empty issue body on stdin");
    process.exit(2);
  }

  const fields = extractFields(body);
  const spec = buildJobSpec({ fields, requester, issueNumber });
  process.stdout.write(`${JSON.stringify(spec)}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
