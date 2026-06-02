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

type AuditScenario =
  | "salesforce-only"
  | "hubspot-only"
  | "cross-system";

interface AuditScenarioConfig {
  modeName: string;
  summaryTitle: string;
  summaryDescription: string;
  directive: string;
}

const MODEL_NAME = "gpt-4o-mini";
const MAX_PAYLOAD_SIZE_BYTES = 1024 * 1024;

const scenarioConfigs: Record<AuditScenario, AuditScenarioConfig> = {
  "salesforce-only": {
    modeName: "Salesforce Configuration Guard",
    summaryTitle: "Internal Salesforce Logic Risk Detected",
    summaryDescription:
      "Internal Salesforce validation logic, formulas, or order-of-execution constraints may block user data entry or automation outcomes.",
    directive: `
You are SyncGuard AI, an elite Salesforce Testing and RevOps Automation Architect operating in Salesforce Configuration Guard mode.

Analyze only internal Salesforce architecture. Drop all mentions of
integrations, HubSpot properties, HubSpot workflows, sync rules, and external
platform dependencies. Focus 100% of the markdown analysis on Salesforce
configuration health: audit validation rule formulas for logical constraints,
assess evaluation criteria for order-of-execution bottlenecks, evaluate
user-experience friction based on error messages, and flag data-entry traps for
standard users.
`.trim()
  },
  "hubspot-only": {
    modeName: "HubSpot Workflow Guard",
    summaryTitle: "Internal HubSpot Automation Risk Detected",
    summaryDescription:
      "Internal HubSpot workflow triggers, action steps, or property update logic may create automation risk before data leaves HubSpot.",
    directive: `
You are SyncGuard AI, an elite HubSpot Workflow and RevOps Automation Architect operating in HubSpot Workflow Guard mode.

Analyze only internal HubSpot automation health. Drop all mentions of
Salesforce fields, Salesforce validation rules, sync failures, and destination
CRM constraints. Focus 100% of the markdown analysis on HubSpot workflow
behavior: audit workflow triggers for potential runaway loops, check action
steps for data formatting issues, flag missing required criteria before
property updates, and highlight optimization opportunities.
`.trim()
  },
  "cross-system": {
    modeName: "Cross-System Sync Audit",
    summaryTitle: "Cross-System Logic Conflict Detected",
    summaryDescription:
      "Cross-system logic conflict detected between your workflow automation and destination validation rules.",
    directive: `
You are SyncGuard AI, an elite Salesforce Testing and RevOps Automation Architect operating in Cross-System Sync Audit mode.

Analyze sanitized Salesforce configuration exports, HubSpot workflow exports,
CRM mapping files, CSVs, JSON structures, TXT notes, and XML metadata for
integration drift, field mapping gaps, type mismatches, validation walls,
automation conflicts, and sync-blocking risks.

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
`.trim()
  }
};

const responseFormatPrompt = `
Your response must be direct, concise markdown and must use explicit
parser-friendly metadata before every issue block:

- Audit Mode: [Salesforce Configuration Guard / HubSpot Workflow Guard / Cross-System Sync Audit]
- System Summary: [mode-specific global summary title]
- System Assessment: [one sentence explaining the highest risk across the whole upload set]

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

function includesAnySignal(text: string, signals: string[]): boolean {
  const normalizedText = text.toLowerCase();

  return signals.some((signal) => normalizedText.includes(signal));
}

/**
 * Routes the audit into single-platform or cross-system mode using lightweight
 * filename/content signals only. The upload remains stateless and in memory.
 */
function detectAuditScenario(files: NormalizedAuditFile[]): AuditScenario {
  const combinedText = files
    .map((file) => `${file.filename}\n${file.content}`)
    .join("\n")
    .toLowerCase();

  const hasSalesforce = includesAnySignal(combinedText, [
    "salesforce",
    "sfdc",
    "validationrule",
    "validation rule",
    "customobject",
    "customfield",
    "trigger",
    "apex",
    "flowdefinition",
    "workflowrule",
    ".object",
    ".field"
  ]);
  const hasHubSpot = includesAnySignal(combinedText, [
    "hubspot",
    "hs_",
    "workflow",
    "property",
    "dealstage",
    "lifecyclestage",
    "pipeline",
    "enrollment",
    "trigger criteria"
  ]);
  const hasMapping = includesAnySignal(combinedText, [
    "mapping",
    "maps to",
    "source field",
    "destination field",
    "salesforce field",
    "hubspot property",
    "crm map"
  ]);

  if (hasSalesforce && hasHubSpot && hasMapping) {
    return "cross-system";
  }

  if (hasSalesforce && !hasHubSpot) {
    return "salesforce-only";
  }

  if (hasHubSpot && !hasSalesforce) {
    return "hubspot-only";
  }

  return hasSalesforce && hasHubSpot ? "cross-system" : "salesforce-only";
}

function buildSystemPrompt(scenario: AuditScenario): string {
  const config = scenarioConfigs[scenario];

  return [
    config.directive,
    responseFormatPrompt,
    `For this request, use exactly this metadata:
- Audit Mode: ${config.modeName}
- System Summary: ${config.summaryTitle}
- System Assessment: ${config.summaryDescription}`
  ].join("\n\n");
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
function buildUserPrompt(
  files: NormalizedAuditFile[],
  scenario: AuditScenario
): string {
  const config = scenarioConfigs[scenario];
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

  return `Audit mode: ${config.modeName}\n\nAudit the following sanitized file payloads and produce the required SyncGuard markdown report.\n\n${fileBlocks}`;
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
    const auditScenario = detectAuditScenario(files);

    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(auditScenario)
        },
        {
          role: "user",
          content: buildUserPrompt(files, auditScenario)
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
