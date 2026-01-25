/**
 * Representa el resultado final del parsing de una petición
 * `multipart/form-data`.
 *
 * Es la estructura que consume el resto del framework
 * (controladores, validadores, etc).
 */
export interface MultipartData {
  fields: Record<string, string>;
  files: UploadedFile[];
}

/**
 * Representa un archivo subido mediante `multipart/form-data`.
 *
 * Es una abstracción de alto nivel lista para ser consumida
 * por controladores y servicios de dominio.
 */
export interface UploadedFile {
  fieldName: string;
  filename: string;
  mimeType: string;
  data: Buffer;
  size: number;
}

/**
 * Representa una parte cruda parseada del body multipart.
 *
 * Es una estructura interna usada por el parser
 * antes de mapear los datos al modelo de dominio (`MultipartData`).
 */
export interface ParsedPart {
  name: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
}
