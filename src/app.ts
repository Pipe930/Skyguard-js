import { Router } from "./routes/router";
import { HttpAdapter } from "./http/httpAdapter";
import { Response } from "./http/response";
import { HttpNotFoundException } from "./exceptions/httpNotFoundException";
import { Server } from "./server/server";
import { NodeServer } from "./server/nodeNativeServer";

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
  /** Instancia única del kernel de la aplicación */
  static instance: App;

  /**
   * Sistema de enrutamiento principal.
   * Responsable de registrar y resolver las rutas definidas por el usuario.
   */
  public router: Router;

  /**
   * Servidor subyacente responsable de aceptar conexiones
   * desde la plataforma de ejecución (Node, etc).
   */
  private server: Server;

  private constructor() {
    this.router = new Router();
    this.server = new NodeServer(this);
  }

  public static get getInstance(): App {
    if (!App.instance) App.instance = new App();
    return App.instance;
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
  public handle(adapter: HttpAdapter): void {
    try {
      const request = adapter.getRequest();
      const response = this.router.resolve(request);

      adapter.sendResponse(response);
    } catch (err) {
      this.handleError(err, adapter);
    }
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
   * Se encarga de traducir excepciones del dominio
   * a respuestas HTTP válidas.
   *
   * En el futuro este método puede evolucionar para:
   * - Middlewares de error.
   * - Páginas de error custom.
   * - Logging estructurado.
   *
   * @param {unknown} err - Error capturado durante la ejecución.
   * @param {HttpAdapter} adapter - Adaptador de salida.
   */
  private handleError(err: unknown, adapter: HttpAdapter): void {
    if (err instanceof HttpNotFoundException) {
      adapter.sendResponse(Response.text("Not found").setStatus(404));
      return;
    }

    adapter.sendResponse(Response.text("Internal Server Error").setStatus(500));
    console.error(err);
  }
}
