import { ContentParser } from "./contentParser";
import { JsonParser } from "./jsonParser";
import { MultipartParser } from "./multipartParser";
import { TextParser } from "./textParser";
import { UrlEncodedParser } from "./urlEncodedParser";
import { XmlParser } from "./xmlParser";

/**
 * Gestor principal de parseo de contenido.
 * Coordina los diferentes parsers y selecciona el apropiado
 * según el Content-Type de la solicitud.
 */
export class ContentParserManager {
  private parsers: ContentParser[] = [];

  constructor() {
    this.registerParser(new JsonParser());
    this.registerParser(new MultipartParser());
    this.registerParser(new UrlEncodedParser());
    this.registerParser(new TextParser());
    this.registerParser(new XmlParser());
  }

  /**
   * Registra un parser personalizado.
   *
   * @param parser
   */
  public registerParser(parser: ContentParser): void {
    this.parsers.unshift(parser); // Insertar al inicio para prioridad
  }

  /**
   * Parsea el contenido usando el parser apropiado.
   *
   * @param body Cuerpo o contenido de la peticion
   * @param contentType Cabecera Content-Type de la petición
   */
  public async parse(
    body: Buffer | string,
    contentType: string = "text/plain",
  ): Promise<unknown> {
    const parser = this.findParser(contentType);

    if (!parser) return Buffer.isBuffer(body) ? body : Buffer.from(body);

    return parser.parse(body, contentType);
  }

  /**
   * Funcion que busca en base al Content-Type el parser, que se
   * utilizara para parsear el cuerpo de la petición.
   *
   * @param contentType Cabecera Content-Type de la petición
   * @returns Devuelve el parser encontrado en la lista
   */
  private findParser(contentType: string): ContentParser | null {
    return this.parsers.find((p) => p.canParse(contentType)) || null;
  }
}
