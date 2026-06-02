"use client";

import { useCallback, useRef, useState } from "react";
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
  const activeAuditRunId = useRef(0);

  const handleClearQueue = useCallback(() => {
    activeAuditRunId.current += 1;
    setFiles([]);
    setReportMarkdown("");
    setError(null);
    setIsLoading(false);
  }, []);

  const handleRunAudit = useCallback(async () => {
    if (files.length === 0 || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);
    const auditRunId = activeAuditRunId.current + 1;
    activeAuditRunId.current = auditRunId;

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

      if (activeAuditRunId.current === auditRunId) {
        setReportMarkdown(payload.reportMarkdown || "");
      }
    } catch (caughtError) {
      if (activeAuditRunId.current === auditRunId) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "SyncGuard audit failed."
        );
      }
    } finally {
      if (activeAuditRunId.current === auditRunId) {
        setIsLoading(false);
      }
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
        onClearQueue={handleClearQueue}
      />
      <ReportPreview reportMarkdown={reportMarkdown} uploadedFiles={files} />
    </div>
  );
}
