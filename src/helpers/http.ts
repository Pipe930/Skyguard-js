import type { TemplateContext } from "types";
import { Response } from "@http/response";
import { FileDownloadHelper } from "@static/fileDownload";

export function json<T>(data: T): Response {
  return Response.json(data);
}

export function text(data: string): Response {
  return Response.text(data);
}

export function redirect(url: string): Response {
  return Response.redirect(url);
}

export async function download(
  path: string,
  filename?: string,
  headers?: Record<string, string>,
): Promise<Response> {
  const downloadClass = new FileDownloadHelper();
  return await downloadClass.download(path, filename, headers);
}

export async function render(
  view: string,
  params: TemplateContext,
  layout?: string,
): Promise<Response> {
  return await Response.render(view, params, layout);
}
