import type { TemplateContext } from "../types";
import { Response } from "../http/response";
import { FileDownloadHelper } from "../static/fileDownload";

/**
 * Creates an HTTP response with a JSON body.
 *
 * @typeParam T - Type of the payload to be serialized.
 * @param data - Data to be serialized as JSON.
 * @returns A `Response` instance with `Content-Type: application/json`.
 *
 * @example
 * return json({ ok: true, userId: 1 });
 */
export function json<T>(data: T): Response {
  return Response.json(data);
}

/**
 * Creates an HTTP response with a plain text body.
 *
 * @param data - Text to be sent as the response body.
 * @returns A `Response` instance with a text-based `Content-Type`.
 *
 * @example
 * return text("Hello world");
 */
export function text(data: string): Response {
  return Response.text(data);
}

/**
 * Creates an HTTP redirect response to the given URL.
 *
 * @param url - Target URL for the redirection (absolute or relative).
 * @returns A `Response` instance configured as a redirect.
 *
 * @example
 * return redirect("/login");
 */
export function redirect(url: string): Response {
  return Response.redirect(url);
}

/**
 * Returns a file as a downloadable response.
 *
 * @param path - File system path to the file (relative or absolute, depending on the runtime).
 * @param filename - Optional filename suggested to the client for the download.
 * @param headers - Optional additional headers to include in the response.
 * @returns A `Promise<Response>` ready to be returned by a route handler.
 *
 * @example
 * return await download("./storage/reports/sales.pdf", "report.pdf", {
 *   "Cache-Control": "no-store",
 * });
 */
export async function download(
  path: string,
  filename?: string,
  headers?: Record<string, string>,
): Promise<Response> {
  const downloadClass = new FileDownloadHelper();
  return await downloadClass.download(path, filename, headers);
}

/**
 * Renders a template/view and returns an HTTP response with the generated HTML.
 *
 * @param view - View identifier or template path, depending on the template system.
 * @param params - Context variables available inside the template.
 * @param layout - Optional layout name used to wrap the rendered view.
 * @returns A `Promise<Response>` containing the rendered HTML.
 *
 * @example
 * return await render("users/profile", { user }, "main");
 */
export async function render(
  view: string,
  params: TemplateContext,
  layout?: string,
): Promise<Response> {
  return await Response.render(view, params, layout);
}
