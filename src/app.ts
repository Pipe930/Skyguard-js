import { Router, RouterGroup } from "./routing/index";
import { type HttpAdapter, HttpMethods, Response } from "./http/index";
import {
  ContentParserException,
  HttpNotFoundException,
  SessionException,
  ValidationException,
} from "./exceptions/index";
import { NodeServer } from "./server/nodeNativeServer";
import { type View, RaptorEngine } from "./views/index";
import { join } from "node:path";
import { singleton } from "./helpers/app";
import type { Middleware, RouteHandler } from "./types";
import { StaticFileHandler } from "./static/fileStaticHandler";

/**
 * La clase App actúa como el *kernel de ejecución* y *orquestador del ciclo de vida*
 * de cada petición HTTP. Es responsable de:
 *
 * - Inicializar y exponer el sistema de enrutamiento.
 * - Recibir peticiones normalizadas a través de adaptadores HTTP.
 * - Resolver la ruta correspondiente.
 * - Ejecutar el controlador asociado.
 * - Enviar la respuesta final al cliente.
 *
 * Esta clase implementa el patrón Singleton para garantizar una única
 * instancia de aplicación durante todo el ciclo de vida del proceso.
 *
 * La arquitectura desacopla completamente el núcleo del framework
 * de la plataforma de ejecución (Node, Bun, Deno, etc.) mediante
 * el uso de {@link HttpAdapter} y {@link Server}.
 */
export class App {
  /**
   * Sistema de enrutamiento principal.
   * Responsable de registrar y resolver las rutas definidas por el usuario.
   */
  private router: Router;

  /**
   * Servidor subyacente responsable de aceptar conexiones
   * desde la plataforma de ejecución (Node, etc).
   */
  private server: NodeServer;

  /**
   * Motor de vistas responsable del renderizado de plantillas.
   *
   * Permite separar la lógica de presentación del dominio
   * de aplicación mediante motores como {@link RaptorEngine}.
   *
   * Es utilizado típicamente dentro de los controladores
   * para generar respuestas HTML.
   */
  public view: View;

  /**
   * Manejador de archivos estáticos
   */
  private staticFileHandler: StaticFileHandler | null = null;

  /**
   * Inicializa y configura la aplicación.
   *
   * Este método actúa como el *Composition Root* del framework:
   * es el único lugar donde se instancian y se conectan
   * las implementaciones concretas de la infraestructura.
   *
   * Responsabilidades:
   * - Crear la instancia singleton de la aplicación.
   * - Registrar el sistema de enrutamiento.
   * - Configurar el servidor HTTP subyacente.
   * - Inicializar el motor de vistas.
   *
   * A partir de este punto, el resto del sistema debe
   * depender únicamente de abstracciones (interfaces),
   * nunca de implementaciones concretas.
   *
   * @returns {App} Retorna la instancia de la clase
   */
  public static bootstrap(): App {
    const app = singleton(App);

    app.router = new Router();
    app.server = new NodeServer(app);
    app.view = new RaptorEngine(join(__dirname, "..", "views"));

    return app;
  }

  /**
   *
   * Este método representa el *pipeline principal de ejecución*:
   *
   * 1. Obtiene la petición normalizada desde el adaptador.
   * 2. Resuelve la ruta correspondiente.
   * 3. Asocia la ruta a la solicitud.
   * 4. Ejecuta el controlador.
   * 5. Despacha la respuesta al cliente.
   *
   * No depende de ninguna plataforma concreta (Node, HTTP nativo, etc).
   *
   * @param {HttpAdapter} adapter - Adaptador responsable de mapear
   * la capa de red al dominio del framework.
   */
  public async handle(adapter: HttpAdapter): Promise<void> {
    try {
      const request = await adapter.getRequest();

      if (this.staticFileHandler && request.getMethod === HttpMethods.get) {
        const staticResponse = await this.staticFileHandler.tryServeFile(
          request.getUrl,
        );

        if (staticResponse) {
          adapter.sendResponse(staticResponse);
          return;
        }
      }

      const response = await this.router.resolve(request);

      adapter.sendResponse(response);
    } catch (err) {
      this.handleError(err, adapter);
    }
  }

  /**
   * Configura el directorio para servir archivos estáticos
   *
   * @param publicPath - Ruta absoluta o relativa al directorio público
   * @returns this para encadenamiento
   *
   * @example
   * app.static(join(__dirname, "public"));
   * // Archivos en /public/css/style.css accesibles en /css/style.css
   */
  public staticFiles(publicPath: string) {
    this.staticFileHandler = new StaticFileHandler(publicPath);
  }

  /**
   * Inicia el servidor HTTP en el puerto indicado utilizando
   * la implementación de {@link Server} configurada.
   *
   * Este método expone una DX similar a Express:
   *
   * @example
   * app.listen(3000);
   *
   * @param {number} port - Puerto TCP donde escuchar.
   */
  public listen(port: number): void {
    this.server.listen(port);
  }

  /**
   * Establece un prefijo global para todas las rutas de la aplicación
   *
   * @param prefix - Prefijo a aplicar (ej: "api", "/v1", "test")
   * @returns this para encadenamiento
   *
   * @example
   * app.setPrefix("api");
   * app.get("/users", handler); // Resultado: /api/users
   */
  public setPrefix(prefix: string) {
    this.router.setPrefix(prefix);
  }

  /**
   * Registra una ruta GET
   *
   * @example
   * app.get('/users', listUsers);
   * app.get('/users/{id}', getUser).setMiddlewares([AuthMiddleware]);
   */
  public get(path: string, action: RouteHandler, middlewares?: Middleware[]) {
    this.router.get(path, action, middlewares);
  }

  /**
   * Registra una ruta POST
   *
   * @example
   * app.post('/users', createUser);
   */
  public post(path: string, action: RouteHandler, middlewares?: Middleware[]) {
    this.router.post(path, action, middlewares);
  }

  /**
   * Registra una ruta PUT
   *
   * @example
   * app.put('/users/{id}', updateUserFull);
   */
  public put(path: string, action: RouteHandler, middlewares?: Middleware[]) {
    this.router.put(path, action, middlewares);
  }

  /**
   * Registra una ruta PATCH
   *
   * @example
   * app.patch('/users/{id}', updateUserPartial);
   */
  public patch(path: string, action: RouteHandler, middlewares?: Middleware[]) {
    this.router.patch(path, action, middlewares);
  }

  /**
   * Registra una ruta DELETE
   *
   * @example
   * app.delete('/users/{id}', deleteUser);
   */
  public delete(
    path: string,
    action: RouteHandler,
    middlewares?: Middleware[],
  ) {
    this.router.delete(path, action, middlewares);
  }

  /**
   * Registra middlewares globales que se ejecutarán en todas las rutas
   *
   * @example
   * app.middlewares([LoggerMiddleware, CorsMiddleware]);
   */
  public middlewares(middlewares: Middleware[]) {
    this.router.middlewares(middlewares);
  }

  /**
   * Crea un grupo de rutas con un prefijo común
   *
   * @example
   * app.group('/api', (api) => {
   *   api.get('/users', listUsers);
   *   api.post('/users', createUser);
   * });
   *
   * @example
   * // Con middlewares
   * app.group('/admin', (admin) => {
   *   admin.use(AuthMiddleware);
   *   admin.get('/dashboard', dashboardHandler);
   * });
   */
  public group(prefix: string, callback: (group: RouterGroup) => void): void {
    return this.router.group(prefix, callback);
  }

  /**
   * Se encarga de traducir excepciones del dominio
   * a respuestas HTTP válidas.
   *
   * En el futuro este método puede evolucionar para:
   * - Middlewares de error.
   * - Páginas de error custom.
   * - Logging estructurado.
   *
   * @param {unknown} error - Error capturado durante la ejecución.
   * @param {HttpAdapter} adapter - Adaptador de salida.
   */
  private handleError(error: unknown, adapter: HttpAdapter): void {
    if (error instanceof HttpNotFoundException) {
      adapter.sendResponse(Response.text("Not found").setStatus(404));
      return;
    }

    if (error instanceof ContentParserException) {
      adapter.sendResponse(
        Response.json({ message: error.message }).setStatus(422),
      );
      return;
    }

    if (error instanceof SessionException) {
      adapter.sendResponse(
        Response.json({ message: error.message }).setStatus(401),
      );
      return;
    }

    if (error instanceof ValidationException) {
      adapter.sendResponse(
        Response.json({
          success: false,
          errors: error.getErrorsByField(),
        }).setStatus(400),
      );
      return;
    }

    adapter.sendResponse(Response.text("Internal Server Error").setStatus(500));
    console.error(error);
  }
}

export const createApp = () => {
  return App.bootstrap();
};
