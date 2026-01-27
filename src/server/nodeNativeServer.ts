import { App } from "../app";
import { createServer } from "node:http";
import { NodeHttpAdapter } from "../http";
import { Server } from "./server";

/**
 * Esta clase representa el iniciador del servidor de NodeJS de manera
 * nativa.
 *
 * En términos de arquitectura, esta clase pertenece a la capa de *delivery* o
 * *infrastructure layer*, y no contiene ninguna lógica de negocio.
 */
export class NodeServer implements Server {
  /**
   * @param app - Instancia del núcleo del framework que gestiona
   * el ciclo de vida de cada request.
   */
  constructor(private readonly app: App) {}

  /**
   * Inicia el servidor HTTP y comienza a escuchar conexiones entrantes.
   *
   * @param port - Puerto TCP en el que el servidor escuchará.
   */
  public listen(port: number): void {
    createServer((req, res) => {
      const adapter = new NodeHttpAdapter(req, res);
      void this.app.handle(adapter);
    }).listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  }
}
