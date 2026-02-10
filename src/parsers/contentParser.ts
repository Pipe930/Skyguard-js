/**
 * Contract for classes responsible for parsing HTTP request bodies.
 *
 * Implementations decide whether they can handle a given `Content-Type`
 * and transform the raw body into a usable structure.
 */
export interface ContentParser {
  /**
   * Determines whether this parser can handle the given content type.
   *
   * @param contentType - Full `Content-Type` header value
   * @returns `true` if the content type can be parsed by this parser
   */
  canParse(contentType: string): boolean;

  /**
   * Parses the raw request body.
   *
   * If the content cannot be parsed, implementations may return
   * the original body.
   *
   * @param body - Raw request body
   * @param contentType - Full `Content-Type` header value
   * (may include charset, boundary, etc.)
   * @returns Parsed content or the original body
   */
  parse(body: Buffer | string, contentType: string): unknown;
}
