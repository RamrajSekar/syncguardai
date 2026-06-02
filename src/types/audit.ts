export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string;
  sanitizedPreview: string;
}

export interface AuditFilePayload {
  filename?: string;
  fileName?: string;
  name?: string;
  fileType?: string;
  type?: string;
  content?: string;
}

export interface AuditRequestBody {
  files?: AuditFilePayload[];
}

export interface AuditApiResponse {
  reportMarkdown?: string;
  error?: string;
}

export interface ApiErrorResponse {
  error: string;
}
