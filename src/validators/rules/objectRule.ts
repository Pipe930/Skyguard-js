import { Validator } from "../validator";
import type {
  FieldDefinition,
  RuleOptions,
  ValidationContext,
  ValidationError,
} from "../types";
import { BaseValidationRule } from "../validationRule";

export class ObjectRule extends BaseValidationRule<Record<string, unknown>> {
  constructor(private readonly objectSchema: Map<string, FieldDefinition>) {
    super("object");
  }

  validate(
    context: ValidationContext,
    options?: RuleOptions,
  ): ValidationError | null {
    const { field, value } = context;

    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return this.createError(
        field,
        options?.message || `${field} must be an object`,
        value,
      );
    }

    const nestedResult = Validator.validate(
      value as Record<string, unknown>,
      this.objectSchema,
    );

    if (nestedResult.errors.length === 0) return null;

    const firstError = nestedResult.errors[0];
    return {
      ...firstError,
      field: `${field}.${firstError.field}`,
    };
  }
}
