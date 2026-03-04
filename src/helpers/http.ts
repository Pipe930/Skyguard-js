import { Response } from "../http/response";

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
export function json(data: unknown): Response {
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
  return await Response.download(path, filename, headers);
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
  data: string,
  params?: Record<string, unknown>,
): Promise<Response> {
  return await Response.render(data, params);
}

/**
 * Sends a file as an HTTP response.
 *
 * This helper is a thin wrapper around `Response.sendFile`, allowing a file
 * to be streamed to the client while optionally applying custom headers
 * and resolving the file path relative to a root directory.
 *
 * @param filePath - Path to the file to send.
 * @param options - Optional configuration for the file response.
 * @param options.headers - Additional HTTP headers to include in the response
 * (e.g. `Content-Type`, `Cache-Control`, `Content-Disposition`).
 * @param options.root - Base directory used to resolve `filePath`.
 * @returns A `Response` object that streams the requested file to the client.
 *
 * @example
 * // Send a file using an absolute path
 * const response = await sendFile("/var/www/files/report.pdf", {});
 *
 * @example
 * // Send a file relative to a root directory
 * const response = await sendFile("report.pdf", {
 *   root: "/var/www/files",
 * });
 *
 * @example
 * // Send a downloadable file
 * const response = await sendFile("report.pdf", {
 *   root: "/var/www/files",
 *   headers: {
 *     "Content-Disposition": "attachment; filename=\"report.pdf\"",
 *   },
 * });
 */
export async function sendFile(
  filePath: string,
  options: {
    headers?: Record<string, string>;
    root?: string;
  },
): Promise<Response> {
  return await Response.sendFile(filePath, options);
}
