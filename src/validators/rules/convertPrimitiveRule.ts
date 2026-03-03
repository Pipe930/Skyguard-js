import { RuleOptions } from "../types";
import { BaseValidationRule } from "../validationRule";

export class ConvertPrimitiveRule<T> extends BaseValidationRule<T> {
  constructor(
    name: string,
    private readonly convert: (value: unknown) => unknown,
    private readonly validateType: (value: unknown) => boolean,
    private readonly message: string,
  ) {
    super(name);
    this.setConverter(this.convert);
    this.rules.push({ rule: this });
  }

  validate(context: { field: string; value: unknown }, options?: RuleOptions) {
    const { field, value } = context;

    if (!this.validateType(value))
      return this.createError(
        field,
        options?.message || `${field} ${this.message}`,
        value,
      );

    return null;
  }
}
