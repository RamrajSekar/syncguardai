import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import type {
  ApiErrorResponse,
  AuditFilePayload,
  AuditRequestBody
} from "@/types/audit";

interface NormalizedAuditFile {
  filename: string;
  fileType: string;
  content: string;
}

const MODEL_NAME = "gpt-4o-mini";
const MAX_PAYLOAD_SIZE_BYTES = 1024 * 1024;

const systemPrompt = `
You are SyncGuard AI, an elite Salesforce Testing and RevOps Automation Architect.

Analyze sanitized Salesforce configuration exports, CRM mapping files, CSVs,
JSON structures, TXT notes, and XML metadata for integration drift, field
mapping gaps, type mismatches, validation walls, automation conflicts, and
sync-blocking risks.

When evaluating configurations, you must strictly trace field dependencies
across both systems using the provided mapping file. Specifically:
1. Locate the field mappings to establish how properties correspond between
   systems, such as how a HubSpot property maps to a Salesforce field.
2. Trace how an automated action or trigger in one system, such as a HubSpot
   workflow setting a property value, impacts fields in the connected system.
3. Cross-reference those mapped fields against the destination system's
   validation rules, evaluation criteria, and formulas to proactively catch
   silent API sync failures, validation walls, or logic blocks before they
   happen.

Your response must be markdown and must use explicit parser-friendly risk
identifiers for every distinct issue or validation result. Format each block
exactly like this:

### [FILENAME]
- Format: [file extension]
- Risk: [high / medium / low]
- [Clear summary sentence detailing the specific data mapping block, type mismatch, or validation wall found]

After all issue blocks, include:

## Remediation Guide

Explain exactly how to fix the detected logic drift. Include specific field
mapping changes, metadata edits, validation-rule adjustments, deployment
sequencing, and retest steps when relevant.

Rules:
- Use "Risk: high" for critical sync blockers, destructive mismatches, invalid
  required mappings, or validation walls that stop data movement.
- Use "Risk: medium" for warnings, manual review needs, nullable ambiguity, or
  likely mapping drift.
- Use "Risk: low" for validated files, informational notes, or no immediate
  mapping blockers.
- Never include raw secrets, credentials, emails, API keys, or personal data.
- Do not invent filenames. Use only filenames provided in the request.
`.trim();

function getStringValue(value: string | undefined, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function getFileExtension(filename: string, fallbackType: string): string {
  const extension = filename.split(".").pop();

  if (extension && extension !== filename) {
    return extension.toLowerCase();
  }

  return fallbackType || "unknown";
}

/**
 * Normalizes flexible frontend payload keys into the server-only shape sent to
 * the AI provider, while preserving stateless memory pass-through behavior.
 */
function normalizeFiles(files: AuditFilePayload[]): NormalizedAuditFile[] {
  return files.map((file, index) => {
    const filename = getStringValue(
      file.filename || file.fileName || file.name,
      `uploaded-file-${index + 1}`
    );
    const explicitType = getStringValue(file.fileType || file.type, "");

    return {
      filename,
      fileType: getFileExtension(filename, explicitType),
      content: typeof file.content === "string" ? file.content : ""
    };
  });
}

function getPayloadSizeBytes(files: NormalizedAuditFile[]): number {
  return new TextEncoder().encode(JSON.stringify(files)).byteLength;
}

function getTotalContentLength(files: NormalizedAuditFile[]): number {
  return files.reduce((total, file) => total + file.content.length, 0);
}

/**
 * Builds the model input from already-sanitized file strings. Raw browser
 * uploads should never reach this route without first passing the client scrubber.
 */
function buildUserPrompt(files: NormalizedAuditFile[]): string {
  const fileBlocks = files
    .map(
      (file) => `Filename: ${file.filename}
Format: ${file.fileType}
Sanitized content:
\`\`\`
${file.content}
\`\`\``
    )
    .join("\n\n---\n\n");

  return `Audit the following sanitized file payloads and produce the required SyncGuard markdown report.\n\n${fileBlocks}`;
}

/**
 * Collapses provider-specific failures into user-safe messages that the
 * frontend can display without leaking implementation details.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const errorName = error.name.toLowerCase();
    const errorMessage = error.message.toLowerCase();

    if (errorName.includes("rate") || errorMessage.includes("rate limit")) {
      return "The AI audit service is currently rate limited. Please wait a moment and try again.";
    }

    if (
      errorName.includes("timeout") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("timed out")
    ) {
      return "The AI audit service timed out before completing the analysis. Please try again with fewer or smaller files.";
    }
  }

  return "SyncGuard AI could not complete the audit request. Please try again.";
}

function jsonError(error: ApiErrorResponse["error"], status: number) {
  return NextResponse.json<ApiErrorResponse>({ error }, { status });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  /** Keeps secret validation server-side before the OpenAI client is created. */
  if (!apiKey) {
    return jsonError(
      "OPENAI_API_KEY is not configured. Add it to the server environment before running an AI audit.",
      500
    );
  }

  try {
    const body = (await request.json()) as AuditRequestBody;

    if (!Array.isArray(body.files) || body.files.length === 0) {
      return jsonError("Request body must include at least one sanitized file.", 400);
    }

    const files = normalizeFiles(body.files);

    /** Enforces the beta payload budget before any external AI API call occurs. */
    if (
      getTotalContentLength(files) > MAX_PAYLOAD_SIZE_BYTES ||
      getPayloadSizeBytes(files) > MAX_PAYLOAD_SIZE_BYTES
    ) {
      return jsonError("Payload exceeds maximum beta limit of 1MB.", 400);
    }

    const openai = new OpenAI();

    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: buildUserPrompt(files)
        }
      ],
      max_tokens: 2000,
      temperature: 0.1
    });

    const reportMarkdown = completion.choices[0]?.message.content?.trim() || "";

    return NextResponse.json({ reportMarkdown });
  } catch (error) {
    return jsonError(getErrorMessage(error), 500);
  }
}
