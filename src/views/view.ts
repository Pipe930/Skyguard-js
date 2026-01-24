import { TemplateContext } from "../utils/types";

/**
 * Contrato de alto nivel para motores de vistas del framework.
 *
 * Representa un sistema completo de renderizado MVC,
 * encargado de:
 *
 * - Resolver archivos de vistas.
 * - Aplicar layouts.
 * - Inyectar contenido.
 * - Delegar parsing a un TemplateEngine.
 *
 * A diferencia de TemplateEngine, un View:
 * - Trabaja con archivos.
 * - Conoce el filesystem.
 * - Implementa composición de vistas.
 *
 * Ejemplo de implementación:
 * - RaptorEngine
 */
export interface View {
  /**
   * Renderiza una vista completa.
   *
   * @param view Nombre de la vista (sin extensión).
   * @param params Contexto de datos.
   * @param layout Layout a utilizar.
   *
   * @returns HTML final listo para ser enviado al cliente.
   *
   * @example
   * view.render("home", { user: { name: "Felipe" } }, "main");
   */
  render: (view: string, params: TemplateContext, layout: string) => string;
}

/**
 * Contrato base para cualquier motor de plantillas del framework.
 *
 * Define la abstracción mínima que debe cumplir un motor capaz
 * de transformar una plantilla de texto en una salida renderizada.
 *
 * Un TemplateEngine:
 * - No conoce layouts.
 * - No conoce archivos.
 * - No conoce MVC.
 * - Solo procesa strings.
 *
 * Su única responsabilidad es:
 *   template (string) + params (contexto) => string
 *
 * Ejemplos de implementaciones:
 * - SimpleTemplateEngine (tu implementación)
 * - HandlebarsAdapter
 * - MustacheAdapter
 * - EjsAdapter
 */
export interface TemplateEngine {
  /**
   * Renderiza una plantilla en memoria.
   *
   * @param template Plantilla como string.
   * @param params Contexto de datos.
   * @returns Resultado renderizado.
   *
   * @example
   * engine.render("Hola {{ name }}", { name: "Felipe" });
   * // => "Hola Felipe"
   */
  render: (template: string, params: TemplateContext) => string;
}
