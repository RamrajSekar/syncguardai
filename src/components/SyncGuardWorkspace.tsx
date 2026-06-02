"use client";

import { useCallback, useState } from "react";
import { DropZone } from "@/components/DropZone";
import { ReportPreview } from "@/components/ReportPreview";
import type {
  AuditApiResponse,
  AuditFilePayload,
  UploadedFile
} from "@/types/audit";

export function SyncGuardWorkspace() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [reportMarkdown, setReportMarkdown] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunAudit = useCallback(async () => {
    if (files.length === 0 || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const filesForAudit: AuditFilePayload[] = files.map((file) => ({
        name: file.name,
        fileType: file.type,
        content: file.content
      }));

      const response = await fetch("/api/audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          files: filesForAudit
        })
      });

      const payload = (await response.json()) as AuditApiResponse;

      if (!response.ok) {
        throw new Error(payload.error || "SyncGuard audit failed.");
      }

      setReportMarkdown(payload.reportMarkdown || "");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "SyncGuard audit failed."
      );
    } finally {
      setIsLoading(false);
    }
  }, [files, isLoading]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <DropZone
        files={files}
        isLoading={isLoading}
        auditError={error}
        onFilesChange={setFiles}
        onRunAudit={handleRunAudit}
      />
      <ReportPreview reportMarkdown={reportMarkdown} />
    </div>
  );
}
