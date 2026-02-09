import { ValidationException } from "../exceptions/validationException";
import type {
  ValidationContext,
  ValidationError,
  ValidationResult,
} from "./types";
import type { FieldDefinition } from "./validationSchema";

/**
 * Motor de validación del framework.
 *
 * Se encarga de **ejecutar** las reglas definidas en un schema
 * contra un conjunto de datos de entrada.
 *
 * ❗ Esta clase NO define reglas ni schemas.
 * Su única responsabilidad es:
 * - iterar sobre los campos del schema
 * - ejecutar sus reglas en orden
 * - recolectar errores de validación
 *
 * El schema es normalmente construido mediante `ValidationSchema`.
 */
export class Validator {
  /**
   * Ejecuta la validación de datos contra un schema.
   *
   * ## Comportamiento
   * - Solo se validan los campos definidos en el schema
   * - Los campos opcionales se ignoran si no existen en los datos
   * - Las reglas se ejecutan en el orden en que fueron definidas
   * - La validación es **fail-fast por campo**
   *   (se detiene en la primera regla fallida de cada campo)
   *
   * ## Flujo interno
   * 1. Se itera cada campo del schema
   * 2. Se construye un `ValidationContext`
   * 3. Se ejecutan las reglas del campo
   * 4. Se recolectan los errores producidos
   *
   * @param data Datos de entrada a validar
   * @param schema Definición del schema de validación
   *
   * @returns Resultado de la validación:
   * - `valid`: indica si los datos son válidos
   * - `errors`: lista de errores encontrados
   * - `data`: datos originales si la validación fue exitosa
   */
  public static validate(
    data: Record<string, unknown>,
    schema: Map<string, FieldDefinition>,
  ): ValidationResult {
    const errors: ValidationError[] = [];

    for (const [fieldName, fieldDef] of schema.entries()) {
      const value = data[fieldName];

      const context: ValidationContext = {
        field: fieldName,
        value,
        data,
      };

      if (fieldDef.optional && value === undefined) continue;

      for (const { rule, options } of fieldDef.rules) {
        const error = rule.validate(context, options);

        if (error) {
          errors.push(error);
          break;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      data: errors.length === 0 ? data : undefined,
    };
  }

  /**
   * Ejecuta la validación y lanza una excepción
   * si se detecta cualquier error.
   *
   * Útil para flujos donde la validación fallida
   * debe interrumpir la ejecución inmediatamente
   * (por ejemplo, controladores HTTP).
   *
   * @param data Datos de entrada a validar
   * @param schema Definición del schema de validación
   *
   * @throws ValidationException cuando la validación falla
   *
   * @returns Los datos originales si la validación es exitosa
   */
  public static validateOrFail(
    data: Record<string, unknown>,
    schema: Map<string, FieldDefinition>,
  ): unknown {
    const result = this.validate(data, schema);

    if (!result.valid) throw new ValidationException(result.errors);

    return result.data!;
  }
}
