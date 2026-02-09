import type { RuleOptions, ValidationContext, ValidationError } from "../types";

/**
 * Contrato base para todas las reglas de validación del framework.
 *
 * Cada implementación representa una **estrategia de validación**
 * independiente (Strategy Pattern).
 *
 * Una regla:
 * - valida un valor dentro de un contexto
 * - NO conoce el schema completo
 * - NO decide si la validación continúa o no
 *
 * Su única responsabilidad es evaluar el valor
 * y devolver un error cuando la validación falla.
 */
export interface ValidationRule {
  /**
   * Nombre único de la regla.
   *
   * Se utiliza para:
   * - identificar la regla en los errores
   * - depuración
   * - serialización de resultados
   *
   * Ejemplos: "required", "string", "email", "min"
   */
  readonly name: string;

  /**
   * Ejecuta la validación de la regla.
   *
   * ## Contrato
   * - Si la validación es exitosa → retorna `null`
   * - Si la validación falla → retorna un `ValidationError`
   *
   * La regla NO debe lanzar excepciones.
   *
   * @param context Contexto de validación actual
   * Contiene información del campo, valor y datos completos.
   *
   * @param options Opciones específicas de la regla
   *
   * @returns Un error de validación o `null` si el valor es válido
   */
  validate(
    context: ValidationContext,
    options?: RuleOptions,
  ): ValidationError | null;
}

/**
 * Clase base abstracta para implementar reglas de validación.
 *
 * Proporciona:
 * - una implementación estándar del nombre de la regla
 * - un helper para construir errores consistentes
 *
 * Las reglas concretas deben:
 * - extender esta clase
 * - implementar únicamente la lógica de validación
 */
export abstract class BaseValidationRule implements ValidationRule {
  /**
   * Crea una nueva regla de validación.
   *
   * @param name Nombre único de la regla
   */
  constructor(public readonly name: string) {}

  /**
   * Ejecuta la validación de la regla.
   *
   * Debe cumplir estrictamente el contrato:
   * - retornar `null` si es válida
   * - retornar `ValidationError` si falla
   */
  abstract validate(
    context: ValidationContext,
    options?: RuleOptions,
  ): ValidationError | null;

  /**
   * Crea un objeto `ValidationError` estandarizado.
   *
   * Este método debe ser usado por las reglas concretas
   * para garantizar errores consistentes en todo el framework.
   *
   * @param field Nombre del campo que falló
   * @param message Mensaje descriptivo del error
   * @param value Valor que no pasó la validación
   *
   * @returns ValidationError
   */
  protected createError(
    field: string,
    message: string,
    value?: unknown,
  ): ValidationError {
    return {
      field,
      message,
      value,
      rule: this.name,
    };
  }
}
