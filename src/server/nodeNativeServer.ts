import { App } from "../app";
import { createServer } from "node:http";
import { NodeHttpAdapter } from "../http";
import { Server } from "./server";

/**
 * Implementación concreta del contrato {@link Server} para el runtime Node.js.
 *
 * Esta clase actúa como *composición de infraestructura*, siendo responsable de:
 *  - Inicializar el servidor HTTP nativo de Node.
 *  - Traducir cada conexión entrante al modelo interno del framework.
 *  - Delegar el procesamiento completo al core {@link App}.
 *
 * En términos de arquitectura, esta clase pertenece a la capa de *delivery* o
 * *infrastructure layer*, y no contiene ninguna lógica de negocio.
 */
export class NodeServer implements Server {
  /**
   * @param {App} app - Instancia del núcleo del framework que gestiona
   * el ciclo de vida de cada request.
   */
  constructor(private readonly app: App) {}

  /**
   * Inicia el servidor HTTP y comienza a escuchar conexiones entrantes.
   *
   * Por cada request:
   *  1. Se crea un {@link NodeHttpAdapter} para adaptar el runtime Node.
   *  2. Se delega el control al método {@link App.handle}.
   *
   * @param {number} port - Puerto TCP en el que el servidor escuchará.
   * @returns {void}
   */
  public listen(port: number): void {
    createServer((req, res) => {
      const adapter = new NodeHttpAdapter(req, res);
      void this.app.handle(adapter);
    }).listen(port);

    console.log(`Server running on http://localhost:${port}`);
  }
}
