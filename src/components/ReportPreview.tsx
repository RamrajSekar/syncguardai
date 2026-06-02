import type { UploadedFile } from "@/types/audit";

type RiskLevel = "high" | "medium" | "low";
type UploadQueueContext = "salesforce-only" | "hubspot-only" | "cross-system";

interface RiskCard {
  level: RiskLevel;
  title: string;
  description: string;
}

interface ReportPreviewProps {
  reportMarkdown: string;
  uploadedFiles: UploadedFile[];
}

const defaultRiskCards: RiskCard[] = [
  {
    level: "high",
    title: "Schema drift detected",
    description: "Payment export fields do not match the expected CRM import map."
  },
  {
    level: "medium",
    title: "Manual approval needed",
    description: "Two nullable columns require owner confirmation before sync."
  },
  {
    level: "low",
    title: "Ready for dry run",
    description: "Sanitized payload is valid for stateless audit processing."
  }
];

const riskStyles: Record<
  RiskLevel,
  { label: string; className: string; headingClassName: string }
> = {
  high: {
    label: "High risk",
    className: "border-red-200 bg-red-50 text-red-800",
    headingClassName: "text-red-900"
  },
  medium: {
    label: "Medium risk",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    headingClassName: "text-amber-900"
  },
  low: {
    label: "Low risk",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    headingClassName: "text-emerald-900"
  }
};

const riskPriority: Record<RiskLevel, number> = {
  high: 3,
  medium: 2,
  low: 1
};

function includesAnySignal(text: string, signals: string[]): boolean {
  const normalizedText = text.toLowerCase();

  return signals.some((signal) => normalizedText.includes(signal));
}

function detectUploadQueueContext(files: UploadedFile[]): UploadQueueContext {
  const combinedText = files
    .map((file) => `${file.name}\n${file.type}\n${file.content}`)
    .join("\n");
  const hasMapping = includesAnySignal(combinedText, [
    "mapping",
    "maps to",
    "source field",
    "destination field",
    "salesforce field",
    "hubspot property",
    "crm map"
  ]);
  const hasSalesforce = includesAnySignal(combinedText, [
    "salesforce",
    "sfdc",
    "vr_",
    "ischanged",
    "validationrule",
    "validation rule",
    "customobject",
    "customfield",
    "apex",
    "flowdefinition"
  ]);
  const hasHubSpot = includesAnySignal(combinedText, [
    "hubspot",
    "hs_",
    "workflow",
    "property",
    "dealstage",
    "lifecyclestage",
    "enrollment",
    "trigger criteria"
  ]);

  if (hasMapping || (hasSalesforce && hasHubSpot)) {
    return "cross-system";
  }

  if (hasSalesforce) {
    return "salesforce-only";
  }

  if (hasHubSpot) {
    return "hubspot-only";
  }

  return "cross-system";
}

function detectHighestRiskLevel(text: string): RiskLevel | null {
  const detectedLevels: RiskLevel[] = [];

  if (
    /\b(HIGH RISK|CRITICAL SYNC|CRITICAL|VALIDATION WALL|LOGIC BLOCK)\b/i.test(
      text
    ) ||
    /\bRisk:\s*high\b/i.test(text)
  ) {
    detectedLevels.push("high");
  }

  if (
    /\b(MEDIUM RISK|WARNING|WARN|MANUAL REVIEW)\b/i.test(text) ||
    /\bRisk:\s*medium\b/i.test(text)
  ) {
    detectedLevels.push("medium");
  }

  if (
    /\b(LOW RISK|VALIDATION SUCCESS|SUCCESS|READY)\b/i.test(text) ||
    /\bRisk:\s*low\b/i.test(text)
  ) {
    detectedLevels.push("low");
  }

  return detectedLevels.reduce<RiskLevel | null>((highestLevel, level) => {
    if (!highestLevel || riskPriority[level] > riskPriority[highestLevel]) {
      return level;
    }

    return highestLevel;
  }, null);
}

function detectSectionRiskLevel(text: string): RiskLevel | null {
  if (/\b(HIGH RISK|CRITICAL SYNC|CRITICAL)\b/i.test(text)) {
    return "high";
  }

  if (/\b(MEDIUM RISK|WARNING|WARN)\b/i.test(text)) {
    return "medium";
  }

  if (/\b(LOW RISK|VALIDATION SUCCESS|SUCCESS|READY)\b/i.test(text)) {
    return "low";
  }

  const riskMatch = text.match(/\bRisk:\s*(high|medium|low)\b/i);

  return riskMatch ? (riskMatch[1].toLowerCase() as RiskLevel) : null;
}

function cleanMarkdownLine(line: string): string {
  return line
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*]\s*/, "")
    .replace(/\b(HIGH|MEDIUM|LOW)\s+RISK:\s*/i, "")
    .replace(/\bRisk:\s*(high|medium|low)\b/i, "")
    .trim();
}

function displayMarkdownLine(line: string): string {
  return line.replace(/^[-*]\s*/, "").trim();
}

function extractDescription(lines: string[]): string {
  const description = lines
    .map(cleanMarkdownLine)
    .find(
      (line) =>
        line.length > 0 &&
        !/^Format:/i.test(line) &&
        !/^Risk:/i.test(line)
    );

  return (
    description ||
    "Review the generated remediation notes for sync validation details."
  );
}

function parseReportSections(markdown: string): string[] {
  return markdown
    .split(/\n(?=#{2,3}\s+)/)
    .map((section) => section.trim())
    .filter(
      (section) =>
        section.length > 0 &&
        !/^#\s+/i.test(section) &&
        !/^#{2,3}\s*Remediation Guide/i.test(section)
    );
}

function parseRiskCards(markdown: string): RiskCard[] {
  if (!markdown.trim()) {
    return defaultRiskCards;
  }

  const cards = parseReportSections(markdown).flatMap((section) => {
    const lines = section.split("\n").filter((line) => line.trim().length > 0);
    const riskLevel = detectSectionRiskLevel(section);

    if (!riskLevel) {
      return [];
    }

    return [
      {
        level: riskLevel,
        title: cleanMarkdownLine(lines[0] || riskStyles[riskLevel].label),
        description: extractDescription(lines.slice(1))
      }
    ];
  });

  return cards.length > 0 ? cards : defaultRiskCards;
}

function getHighRiskQueueCopy(context: UploadQueueContext): RiskCard {
  if (context === "salesforce-only") {
    return {
      level: "high",
      title: "Internal Salesforce Logic Risk Detected",
      description:
        "Validation formula or constraint risks identified within your native Salesforce configuration."
    };
  }

  if (context === "hubspot-only") {
    return {
      level: "high",
      title: "Internal HubSpot Automation Risk Detected",
      description:
        "Potential runaway loops or action logic risks identified within your native HubSpot workflows."
    };
  }

  return {
    level: "high",
    title: "Critical risk",
    description:
      "Cross-system logic conflict detected between your workflow automation and destination validation rules."
  };
}

function getSystemRiskSummary(
  markdown: string,
  uploadQueueContext: UploadQueueContext
): RiskCard | null {
  if (!markdown.trim()) {
    return null;
  }

  const highestRiskLevel = detectHighestRiskLevel(markdown);
  const summaryMatch = markdown.match(/^- System Summary:\s*(.+)$/im);
  const assessmentMatch = markdown.match(/^- System Assessment:\s*(.+)$/im);
  const fallbackTitle =
    summaryMatch?.[1]?.trim() ||
    (markdown.match(/^- Audit Mode:\s*(.+)$/im)?.[1]?.trim() ?? null);
  const fallbackDescription = assessmentMatch?.[1]?.trim();

  if (highestRiskLevel === "high") {
    const queueCopy = getHighRiskQueueCopy(uploadQueueContext);

    return {
      ...queueCopy,
      title: queueCopy.title || fallbackTitle || "Critical risk",
      description: queueCopy.description || fallbackDescription || ""
    };
  }

  if (highestRiskLevel === "medium") {
    return {
      level: "medium",
      title: fallbackTitle || "System warning",
      description:
        fallbackDescription ||
        "Potential mapping drift or review-dependent automation behavior was detected across the audited configuration set."
    };
  }

  if (highestRiskLevel === "low") {
    return {
      level: "low",
      title: fallbackTitle || "System validation ready",
      description:
        fallbackDescription ||
        "No critical cross-system sync blockers were identified in the uploaded audit set."
    };
  }

  return null;
}

function RiskSummaryCard({ card }: { card: RiskCard }) {
  const styles = riskStyles[card.level];

  return (
    <article className={`rounded-md border p-4 ${styles.className}`}>
      <p className="text-xs font-bold uppercase tracking-[0.12em]">
        {styles.label}
      </p>
      <h3 className={`mt-2 text-base font-semibold ${styles.headingClassName}`}>
        {card.title}
      </h3>
      <p className="mt-1 text-sm leading-6">{card.description}</p>
    </article>
  );
}

function SystemRiskSummaryCard({ summary }: { summary: RiskCard }) {
  const styles = riskStyles[summary.level];
  const label = summary.level === "high" ? "Critical risk" : styles.label;

  return (
    <article className={`rounded-md border p-5 ${styles.className}`}>
      <p className="text-xs font-bold uppercase tracking-[0.12em]">{label}</p>
      <h3 className={`mt-2 text-lg font-semibold ${styles.headingClassName}`}>
        {summary.title}
      </h3>
      <p className="mt-2 text-sm leading-6">{summary.description}</p>
    </article>
  );
}

function MarkdownDetails({ markdown }: { markdown: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
      {markdown.split("\n").map((line, index) => {
        const key = `${index}-${line}`;

        if (line.startsWith("# ")) {
          return (
            <h3 className="mb-3 text-lg font-semibold text-slate-950" key={key}>
              {cleanMarkdownLine(line)}
            </h3>
          );
        }

        if (line.startsWith("## ") || line.startsWith("### ")) {
          return (
            <h4
              className="mt-4 border-t border-slate-200 pt-4 font-semibold text-slate-900 first:mt-0 first:border-t-0 first:pt-0"
              key={key}
            >
              {cleanMarkdownLine(line)}
            </h4>
          );
        }

        if (line.startsWith("- ")) {
          return (
            <p className="pl-3 text-slate-600" key={key}>
              <span className="mr-2 text-emerald-700">-</span>
              {displayMarkdownLine(line)}
            </p>
          );
        }

        if (line.trim().length === 0) {
          return <div className="h-2" key={key} />;
        }

        return <p key={key}>{line}</p>;
      })}
    </div>
  );
}

export function ReportPreview({
  reportMarkdown,
  uploadedFiles
}: ReportPreviewProps) {
  const uploadQueueContext = detectUploadQueueContext(uploadedFiles);
  const systemRiskSummary = getSystemRiskSummary(
    reportMarkdown,
    uploadQueueContext
  );
  const riskCards = parseRiskCards(reportMarkdown);

  return (
    <aside className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
          Report tier
        </p>
        <h2 className="text-xl font-semibold text-slate-950">
          Markdown audit preview
        </h2>
        <p className="text-sm leading-6 text-slate-600">
          This presentation layer is ready for generated markdown and
          color-coded risk summaries.
        </p>
      </div>

      {systemRiskSummary ? (
        <SystemRiskSummaryCard summary={systemRiskSummary} />
      ) : null}

      <div className="flex flex-col gap-3">
        {riskCards.map((card) => (
          <RiskSummaryCard card={card} key={`${card.level}-${card.title}`} />
        ))}
      </div>

      {reportMarkdown ? <MarkdownDetails markdown={reportMarkdown} /> : null}
    </aside>
  );
}
