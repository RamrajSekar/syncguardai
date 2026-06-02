"use client";

import { useCallback, useRef, useState } from "react";
import type { UploadedFile } from "@/types/audit";
import { scrubPiiFromText } from "@/utils/piiScrubber";

interface DropZoneProps {
  files: UploadedFile[];
  isLoading: boolean;
  auditError: string | null;
  onFilesChange: (files: UploadedFile[]) => void;
  onRunAudit: () => void;
  onClearQueue: () => void;
}

interface AcceptedFileTypes {
  extensions: string[];
  mimeTypes: string[];
}

const MAX_SINGLE_FILE_SIZE = 1 * 1024 * 1024;
const MAX_TOTAL_QUEUE_SIZE = 1.5 * 1024 * 1024;

const acceptedFileTypes: AcceptedFileTypes = {
  extensions: [".csv", ".json", ".txt", ".xml"],
  mimeTypes: [
    "text/csv",
    "application/json",
    "text/plain",
    "text/xml",
    "application/xml"
  ]
};

const acceptedTypes = [
  ...acceptedFileTypes.extensions,
  ...acceptedFileTypes.mimeTypes
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAcceptedFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  return (
    acceptedFileTypes.extensions.some((extension) =>
      lowerName.endsWith(extension)
    ) || acceptedFileTypes.mimeTypes.includes(fileType)
  );
}

function getTotalQueuedFileSize(files: UploadedFile[]): number {
  return files.reduce((total, file) => total + file.size, 0);
}

function createUploadId(file: File): string {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${file.name}-${file.size}-${randomPart}`;
}

export function DropZone({
  files,
  isLoading,
  auditError,
  onFilesChange,
  onRunAudit,
  onClearQueue
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  /**
   * Reads files as browser-side text, scrubs PII before staging, and enforces
   * the beta payload cap before anything can be sent to the backend route.
   */
  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    setUploadError(null);

    const nextFiles = Array.from(fileList);
    const oversizedFile = nextFiles.find(
      (file) => file.size > MAX_SINGLE_FILE_SIZE
    );

    if (oversizedFile) {
      setUploadError(
        `\u26A0\uFE0F File too large: ${oversizedFile.name} exceeds the 1MB budget limit. Please upload structural configuration metadata chunks only.`
      );
      return;
    }

    const existingQueueSize = getTotalQueuedFileSize(files);
    const incomingBatchSize = nextFiles.reduce(
      (total, file) => total + file.size,
      0
    );

    if (existingQueueSize + incomingBatchSize > MAX_TOTAL_QUEUE_SIZE) {
      setUploadError(
        "\u26A0\uFE0F Batch upload limit exceeded: The combined size of your selected configuration files exceeds the 1.5MB maximum. Please optimize your metadata or clear your current queue before uploading more files."
      );
      return;
    }

    const unsupportedFile = nextFiles.find((file) => !isAcceptedFile(file));

    if (unsupportedFile) {
      setUploadError("Only CSV, JSON, TXT, or XML files can be added.");
      return;
    }

    const sanitizedFiles: UploadedFile[] = await Promise.all(
      nextFiles.map(async (file) => {
        const rawText = await file.text();
        const sanitizedText = scrubPiiFromText(rawText);

        return {
          id: createUploadId(file),
          name: file.name,
          size: file.size,
          type: file.type || "text/plain",
          content: sanitizedText,
          sanitizedPreview: sanitizedText.slice(0, 180)
        };
      })
    );

    onFilesChange([...files, ...sanitizedFiles]);
  }, [files, onFilesChange]);

  const canRunAudit = files.length > 0 && !isLoading;
  const canClearQueue = files.length > 0 || Boolean(auditError);

  return (
    <section className="flex flex-col gap-4">
      <div
        className={[
          "flex min-h-[320px] flex-col items-center justify-center gap-5 rounded-lg border-2 border-dashed bg-white p-8 text-center shadow-sm transition",
          isDragging
            ? "border-teal-500 bg-teal-50"
            : "border-slate-300 hover:border-slate-400"
        ].join(" ")}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-2xl text-teal-800">
          +
        </div>
        <div className="flex max-w-md flex-col gap-2">
          <h2 className="text-xl font-semibold text-slate-950">
            Drop CSV, JSON, TXT, or XML files here
          </h2>
          <p className="text-sm leading-6 text-slate-600">
            Multiple files are supported. Each file must be 1MB or less, with a
            1.5MB total queue limit. File contents are scrubbed locally before
            they are ready for audit processing.
          </p>
        </div>
        <button
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          Select files
        </button>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept={acceptedTypes.join(",")}
          multiple
          onChange={(event) => {
            if (event.target.files) {
              void handleFiles(event.target.files);
            }
            event.target.value = "";
          }}
        />
      </div>

      {uploadError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {uploadError}
        </p>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Sanitized upload queue
          </h3>
        </div>
        {files.length > 0 ? (
          <ul className="divide-y divide-slate-200">
            {files.map((file) => (
              <li className="flex flex-col gap-2 px-4 py-3" key={file.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">{file.name}</p>
                  <span className="text-xs font-semibold text-slate-500">
                    {formatBytes(file.size)}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs leading-5 text-slate-500">
                  {file.sanitizedPreview || "No readable preview available."}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-sm text-slate-500">
            Files you add will appear here after local PII scrubbing.
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <button
          className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:active:scale-100"
          type="button"
          disabled={!canClearQueue || isLoading}
          onClick={() => {
            setUploadError(null);
            onClearQueue();
          }}
        >
          Clear Queue
        </button>
        <button
          className="rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white shadow-md transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none disabled:hover:bg-slate-300 disabled:active:scale-100"
          type="button"
          disabled={!canRunAudit}
          onClick={onRunAudit}
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Analyzing configurations...
            </span>
          ) : (
            "Run SyncGuard Audit"
          )}
        </button>
      </div>
      <div className="flex justify-center">
        {auditError ? (
          <p className="max-w-md text-center text-sm font-medium text-red-700">
            {auditError}
          </p>
        ) : null}
      </div>
    </section>
  );
}
