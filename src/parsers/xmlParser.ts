import { ContentParserException } from "@exceptions/contentParserException";
import type { ContentParser } from "./contentParser";

/**
 * Parser de contenido XML.
 *
 * Este parser implementa un **mecanismo liviano y seguro** para interpretar
 * contenido XML, pensado principalmente para **cuerpos de solicitudes HTTP**
 * (request bodies).
 *
 * ## Alcance y limitaciones
 * - Diseñado para XML **simple y bien formado**
 * - **NO soporta**:
 *   - Atributos XML
 *   - Namespaces
 *   - CDATA
 *   - Validación por DTD o Schema
 *   - Contenido mixto (texto + nodos hijos)
 *
 * ## Características
 * - Soporta `application/xml` y `text/xml`
 * - Valida que los tags estén correctamente balanceados
 * - Convierte tags repetidos en arrays
 * - Realiza conversión básica de tipos (number, boolean, null)
 * - Decodifica entidades HTML/XML comunes
 *
 * ## Uso recomendado
 * Este parser está pensado para ser utilizado por un `ContentParserManager`
 * dentro del framework y **no pretende reemplazar** un parser XML completo.
 */
export class XmlParser implements ContentParser {
  /**
   * Determina si el parser puede manejar el tipo de contenido indicado.
   *
   * @param contentType - Valor del header `Content-Type`
   * @returns `true` si el contenido es XML
   */
  public canParse(contentType: string): boolean {
    return (
      contentType.includes("application/xml") ||
      contentType.includes("text/xml")
    );
  }

  /**
   * Parsea una entrada XML y la convierte en un objeto JavaScript.
   *
   * @param input - Contenido XML crudo
   * @returns Objeto con la estructura parseada
   *
   * @throws ContentParserException
   * - Si el XML está vacío
   * - Si la estructura es inválida
   * - Si los tags están mal cerrados o desbalanceados
   */
  public parse(input: string | Buffer): Record<string, unknown> {
    const text = Buffer.isBuffer(input) ? input.toString("utf-8") : input;

    if (!text || text.trim().length === 0)
      throw new ContentParserException("XML input is empty");

    const cleanXml = text
      .replace(/<\?xml[^?]*\?>/g, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .trim();

    if (!cleanXml.startsWith("<") || !cleanXml.endsWith(">"))
      throw new ContentParserException("Invalid XML structure");

    this.validateBalancedTags(cleanXml);

    return this.parseXmlContent(cleanXml);
  }

  /**
   * Valida que los tags XML estén correctamente balanceados.
   *
   * Utiliza una pila (stack) para asegurar que:
   * - Cada tag de apertura tenga su cierre correspondiente
   * - Los tags se cierren en el orden correcto
   *
   * @param xml - XML limpio y normalizado
   *
   * @throws ContentParserException
   * - Si se encuentra un cierre inesperado
   * - Si queda algún tag sin cerrar
   */
  private validateBalancedTags(xml: string): void {
    const stack: string[] = [];
    const tagRegex = /<\/?(\w+)[^>]*>/g;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(xml)) !== null) {
      const fullTag = match[0];
      const tagName = match[1];

      if (fullTag.startsWith("</")) {
        if (stack.length === 0 || stack.pop() !== tagName)
          throw new ContentParserException(
            `Tag de cierre inesperado o mal emparejado: </${tagName}>`,
          );
      } else {
        stack.push(tagName);
      }
    }

    if (stack.length > 0)
      throw new ContentParserException(
        `Tag sin cerrar: <${stack[stack.length - 1]}>`,
      );
  }

  /**
   * Parsea el elemento raíz del XML.
   *
   * Si el tag raíz es considerado genérico
   * (`root`, `data`, `xml`, `request`, `response`),
   * se elimina el wrapper y se devuelve solo su contenido.
   *
   * @param xml - XML completo
   * @returns Objeto parseado
   */
  private parseXmlContent(xml: string): Record<string, unknown> {
    const rootMatch = xml.match(/^<(\w+)[^>]*>([\s\S]*)<\/\1>$/);

    if (!rootMatch)
      throw new ContentParserException("Elemento raíz XML inválido");

    const [, rootTag, content] = rootMatch;
    const parsed = this.parseContent(content);

    const genericRoots = ["root", "data", "xml", "response", "request"];
    if (genericRoots.includes(rootTag.toLowerCase()))
      return typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : { [rootTag]: parsed };

    return { [rootTag]: parsed };
  }

  /**
   * Parsea recursivamente el contenido de un nodo XML.
   *
   * - Convierte nodos hijos en objetos
   * - Convierte tags repetidos en arrays
   * - Convierte texto plano en valores primitivos
   *
   * @param content - Contenido interno del nodo
   * @returns Valor parseado
   */
  private parseContent(content: string): unknown {
    const trimmed = content.trim();

    if (!trimmed) return null;
    if (!trimmed.includes("<")) return this.parseValue(trimmed);

    const result: Record<string, unknown> = {};
    const tagRegex = /<(\w+)[^>]*>([\s\S]*?)<\/\1>|<(\w+)[^>]*\/>/g;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(content)) !== null) {
      if (match[1]) {
        const tagName = match[1];
        const tagContent = match[2];

        const value = this.parseContent(tagContent);
        this.addValueToResult(result, tagName, value);
      } else if (match[3]) {
        this.addValueToResult(result, match[3], null);
      }
    }

    if (Object.keys(result).length === 0) return this.parseValue(trimmed);

    return result;
  }

  /**
   * Agrega un valor al resultado final.
   *
   * Si la clave ya existe, los valores se agrupan en un array.
   *
   * @param result - Objeto destino
   * @param key - Nombre del tag
   * @param value - Valor parseado
   */
  private addValueToResult(
    result: Record<string, unknown>,
    key: string,
    value: unknown,
  ): void {
    if (key in result) {
      if (Array.isArray(result[key])) {
        (result[key] as unknown[]).push(value);
      } else {
        result[key] = [result[key], value];
      }
    } else {
      result[key] = value;
    }
  }

  /**
   * Convierte un valor de texto a su tipo primitivo correspondiente.
   *
   * @param value - Valor en texto
   * @returns Valor convertido
   */
  private parseValue(value: string): unknown {
    const trimmed = value.trim();

    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null" || trimmed === "") return null;
    if (!isNaN(Number(trimmed)) && trimmed !== "") return Number(trimmed);

    return this.decodeHtmlEntities(trimmed);
  }

  /**
   * Decodifica entidades HTML/XML comunes.
   *
   * Entidades soportadas:
   * - `&lt;` → `<`
   * - `&gt;` → `>`
   * - `&amp;` → `&`
   * - `&quot;` → `"`
   * - `&apos;` → `'`
   *
   * @param text - Texto codificado
   * @returns Texto decodificado
   */
  private decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      "&lt;": "<",
      "&gt;": ">",
      "&amp;": "&",
      "&quot;": '"',
      "&apos;": "'",
    };

    return text.replace(/&(lt|gt|amp|quot|apos);/g, (match) => {
      return entities[match] || match;
    });
  }
}
