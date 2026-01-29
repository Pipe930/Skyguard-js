import { TemplateContext } from "utils/types";
import { Response } from "../http";

export function json<T>(data: T): Response {
  return Response.json(data);
}

export function text(data: string): Response {
  return Response.text(data);
}

export function redirect(url: string): Response {
  return Response.redirect(url);
}

export async function view(
  view: string,
  params: TemplateContext,
  layout: string,
): Promise<Response> {
  return await Response.view(view, params, layout);
}
