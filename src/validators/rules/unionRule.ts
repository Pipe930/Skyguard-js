import type { RuleOptions, ValidationContext, ValidationError } from "../types";
import { BaseValidationRule } from "../validationRule";

export class UnionRule extends BaseValidationRule {
  constructor(private readonly unionRules: BaseValidationRule[]) {
    super("union");
  }

  validate(
    context: ValidationContext,
    options?: RuleOptions,
  ): ValidationError | null {
    const { field, value } = context;

    for (const unionRule of this.unionRules) {
      const rules = unionRule.rules.length
        ? unionRule.rules
        : [{ rule: unionRule, options: undefined }];

      let hasError = false;

      for (const { rule, options: ruleOptions } of rules) {
        const error = rule.validate({ field, value }, ruleOptions);

        if (error) {
          hasError = true;
          break;
        }
      }

      if (!hasError) return null;
    }

    return this.createError(
      field,
      options?.message || `${field} must match at least one union rule`,
      value,
    );
  }
}
