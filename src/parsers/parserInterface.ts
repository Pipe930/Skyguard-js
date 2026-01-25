export interface MultipartData {
  fields: Record<string, string>;
  files: UploadedFile[];
}

export interface UploadedFile {
  fieldName: string;
  filename: string;
  mimeType: string;
  data: Buffer;
  size: number;
}

export interface ParsedPart {
  name: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
}
