/**
 * Resultado de una validación individual.
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
  rule: string;
}

/**
 * Resultado completo de validación.
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  data?: unknown;
}

/**
 * Opciones de una regla de validación.
 */
export interface RuleOptions {
  message?: string;
  [key: string]: unknown;
}

/**
 * Contexto de validación.
 */
export interface ValidationContext {
  field: string;
  value: unknown;
  data: unknown;
}
