import { Router } from "./routers";
import { HttpAdapter, Response } from "./http";
import {
  ContentParserException,
  HttpNotFoundException,
  ValidationException,
} from "./exceptions";
import { Server, NodeServer } from "./server";
import { View, RaptorEngine } from "./views";
import { join } from "node:path";
import { singleton } from "./helpers";

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
  public router: Router;

  /**
   * Servidor subyacente responsable de aceptar conexiones
   * desde la plataforma de ejecución (Node, etc).
   */
  private server: Server;

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
      const response = await this.router.resolve(request);

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

    if (error instanceof ValidationException) {
      adapter.sendResponse(
        Response.json({
          success: false,
          errors: error.getErrorsByField(),
        }).setStatus(422),
      );
      return;
    }

    adapter.sendResponse(Response.text("Internal Server Error").setStatus(500));
    console.error(error);
  }
}
