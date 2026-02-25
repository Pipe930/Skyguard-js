import { RuleOptions, ValidationContext, ValidationError } from "../types";
import { BaseValidationRule } from "../validationRule";

export class LiteralRule extends BaseValidationRule {
  private literalValue: unknown;

  constructor(literal: unknown) {
    super("literal");
    this.literalValue = literal;
  }

  validate(
    context: ValidationContext,
    options?: RuleOptions,
  ): ValidationError | null {
    const { field, value } = context;

    if (!value || value !== this.literalValue)
      return this.createError(
        field,
        options?.message || `${field} is not a valid literal`,
        value,
      );

    return null;
  }
}
