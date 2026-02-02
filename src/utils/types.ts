import { Response, Request, HttpMethods } from "../http";
import { Layer } from "../routing";
import { IncomingHttpHeaders } from "node:http";

/**
 * Función controladora de una ruta.
 *
 * Representa el *endpoint final* dentro del pipeline de ejecución:
 * recibe una {@link Request} ya normalizada y debe retornar
 * obligatoriamente una {@link Response}.
 *
 * @example
 * const handler: RouteHandler = (req) => {
 *   return Response.json({ message: "Hello world" });
 * };
 */
export type RouteHandler = (request: Request) => Promise<Response> | Response;

/**
 * Estructura de almacenamiento de todas las rutas del framework.
 *
 * Mapa indexado por método HTTP donde cada clave contiene
 * una lista ordenada de clases {@link Layer}.
 *
 * La estructura resultante es:
 *
 * {
 *   GET:   [Layer, Layer, ...],
 *   POST:  [Layer],
 *   PUT:   [],
 *   ...
 * }
 *
 * Se define como {@link Partial} porque no todos los métodos
 * deben estar presentes necesariamente.
 *
 * Este tipo actúa como el *routing table* interno del framework.
 */
export type HashMapRouters = Partial<Record<HttpMethods, Layer[]>>;

/**
 * Representación tipada de los headers HTTP entrantes.
 *
 * Alias directo de {@link IncomingHttpHeaders} de Node.js,
 * utilizado para desacoplar el dominio del framework
 * de la implementación concreta del runtime.
 */
export type Headers = IncomingHttpHeaders;

/**
 * Tipo genérico para valores HTTP serializables.
 *
 * Representa cualquier valor válido que pueda ser:
 * - Serializado como JSON.
 * - Enviado como texto plano.
 * - O explícitamente nulo.
 *
 * Usado principalmente en:
 * - Bodies de respuesta.
 * - Payloads dinámicos.
 */
export type HttpValue = Record<string, unknown> | string | null;

/**
 * Función de continuación del pipeline de middlewares.
 *
 * Representa el "next" dentro del patrón Chain of Responsibility.
 *
 * Cada middleware debe:
 * 1. Ejecutar su lógica.
 * 2. Invocar a `next(request)` para delegar
 *    al siguiente middleware.
 */
export type NextFunction = (request: Request) => Response | Promise<Response>;

/**
 * Función helper para motores de plantillas.
 *
 * Representa una función utilitaria invocable desde
 * una vista (template) para transformar datos.
 *
 * @example
 * engine.registerHelper("upper", (value) =>
 *   String(value).toUpperCase()
 * );
 *
 * Uso en template:
 * {{ upper name }}
 */
export type HelperFunction = (...args: unknown[]) => string;

/**
 * Contexto de datos pasado a una vista.
 *
 * Mapa clave-valor que representa el *ViewModel*
 * consumido por el motor de plantillas.
 *
 * Actúa como una abstracción genérica del modelo
 * en el patrón MVC.
 */
export type TemplateContext = Record<string, unknown>;

/**
 * Tipo genérico para constructores de clases.
 *
 * Representa cualquier clase instanciable
 * mediante el operador `new`.
 *
 * Usado principalmente en:
 * - Contenedores de dependencias.
 * - Factories.
 * - IoC / Service Locator.
 *
 * @example
 * function resolve<T>(ctor: Constructor<T>): T {
 *   return new ctor();
 * }
 */
export type Constructor<T = unknown> = new (...args: unknown[]) => T;
