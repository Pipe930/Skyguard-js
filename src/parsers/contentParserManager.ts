import { ContentParser } from "./contentParser";
import { JsonParser } from "./jsonParser";
import { MultipartParser } from "./multipartParser";
import { TextParser } from "./textParser";
import { UrlEncodedParser } from "./urlEncodedParser";

/**
 * Gestor principal de parseo de contenido.
 * Coordina los diferentes parsers y selecciona el apropiado
 * según el Content-Type de la solicitud.
 */
export class ContentParserManager {
  private parsers: ContentParser[] = [];

  constructor() {
    // Registrar parsers por defecto en orden de especificidad
    this.registerParser(new JsonParser());
    this.registerParser(new MultipartParser());
    this.registerParser(new UrlEncodedParser());
    this.registerParser(new TextParser());
  }

  /**
   * Registra un parser personalizado.
   */
  public registerParser(parser: ContentParser): void {
    this.parsers.unshift(parser); // Insertar al inicio para prioridad
  }

  /**
   * Parsea el contenido usando el parser apropiado.
   */
  public async parse(
    body: Buffer | string,
    contentType: string = "text/plain",
  ): Promise<unknown> {
    const parser = this.findParser(contentType);

    if (!parser) {
      // Si no hay parser, retornar el body como Buffer
      return Buffer.isBuffer(body) ? body : Buffer.from(body);
    }

    return parser.parse(body, contentType);
  }

  private findParser(contentType: string): ContentParser | null {
    return this.parsers.find((p) => p.canParse(contentType)) || null;
  }
}
