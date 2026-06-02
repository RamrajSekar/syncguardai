type RiskLevel = "high" | "medium" | "low";

type RiskCard = {
  level: RiskLevel;
  title: string;
  description: string;
};

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

type ReportPreviewProps = {
  reportMarkdown: string;
};

function detectRiskLevel(text: string): RiskLevel | null {
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

function parseRiskCards(markdown: string): RiskCard[] {
  if (!markdown.trim()) {
    return defaultRiskCards;
  }

  const sections = markdown
    .split(/\n(?=##\s+)/)
    .map((section) => section.trim())
    .filter(Boolean);

  const cards = sections.flatMap((section) => {
    const lines = section.split("\n").filter((line) => line.trim().length > 0);
    const riskLevel = detectRiskLevel(section);

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

        if (line.startsWith("## ")) {
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

export function ReportPreview({ reportMarkdown }: ReportPreviewProps) {
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

      <div className="flex flex-col gap-3">
        {riskCards.map((card) => (
          <RiskSummaryCard card={card} key={`${card.level}-${card.title}`} />
        ))}
      </div>

      {reportMarkdown ? <MarkdownDetails markdown={reportMarkdown} /> : null}
    </aside>
  );
}
