/** Browser-side regex redaction rules for common PII and secret-like fields. */
const patterns: Array<[RegExp, string]> = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]"],
  [/\b(?:api[_-]?key|token|secret|password)\b\s*[:=]\s*["']?[^"',\s}]+/gi, "[redacted-secret]"],
  [/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, "[redacted-name]"]
];

/** Applies all local redaction rules before payloads can be queued for audit. */
export function scrubPiiFromText(input: string): string {
  return patterns.reduce(
    (sanitizedText, [pattern, replacement]) =>
      sanitizedText.replace(pattern, replacement),
    input
  );
}
