import type { FieldDefinition } from "./types";
import type { BaseValidationRule } from "./validationRule";
import {
  BooleanRule,
  DateRule,
  type DateRuleOptions,
  NumberRule,
  type NumberRuleOptions,
  StringRule,
  type StringRuleOptions,
  ArrayRule,
  type ArrayRuleOptions,
  LiteralRule,
} from "./rules";

/**
 * Main validator class - provides factory methods for creating validators
 */
class Validator {
  /**
   * Creates a string validator
   *
   * @param options - String validation options (maxLength, minLength, isEmpty, etc.)
   * @returns StringValidator instance
   *
   * @example
   * validator.string({ maxLength: 60, isEmpty: false })
   */
  string(options?: StringRuleOptions): StringRule {
    const stringRule = new StringRule();
    stringRule.rules.push({ rule: stringRule, options });
    return stringRule;
  }

  /**
   * Creates a number validator
   *
   * @param options - Number validation options (min, max, etc.)
   * @returns NumberValidator instance
   *
   * @example
   * validator.number({ min: 18, max: 65 })
   */
  number(options?: NumberRuleOptions): NumberRule {
    const numberRule = new NumberRule();
    numberRule.rules.push({ rule: numberRule, options });
    return numberRule;
  }

  /**
   * Creates a boolean validator
   *
   * @param message - Optional custom error message
   * @returns BooleanValidator instance
   *
   * @example
   * validator.boolean().required()
   */
  boolean(message?: string): BooleanRule {
    const booleanRule = new BooleanRule();
    booleanRule.rules.push({ rule: booleanRule, options: { message } });
    return booleanRule;
  }

  /**
   * Creates a date validator
   *
   * @param options - Date validation options (min, max, etc.)
   * @returns DateValidator instance
   *
   * @example
   * validator.date({ max: new Date() })
   */
  date(options?: DateRuleOptions): DateRule {
    const dateRule = new DateRule();
    dateRule.rules.push({ rule: dateRule, options });
    return dateRule;
  }

  /**
   * Creates an array validator
   *
   * @param options - Array validation options (minItems, maxItems, itemRules, etc.)
   * @returns ArrayRule instance
   *
   * @example
   * validator.array({ minLength: 1 }).string()
   */
  array(typeValid?: BaseValidationRule, options?: ArrayRuleOptions): ArrayRule {
    const arrayRule = new ArrayRule(typeValid);
    arrayRule.rules.push({ rule: arrayRule, options });
    return arrayRule;
  }

  /**
   * Creates a literal value validator
   *
   * @param value - The literal value to validate against
   * @param message - Optional custom error message
   * @returns LiteralRule instance
   *
   * @example
   * validator.literal("admin").required()
   */
  literal(value: unknown, message?: string): LiteralRule {
    const literalRule = new LiteralRule(value);
    literalRule.rules.push({
      rule: literalRule,
      options: { message },
    });
    return literalRule;
  }
}

/**
 * ValidationSchema - Internal representation of validation rules
 *
 * This class is created by the Validator.schema() method and contains
 * the compiled validation rules for all fields.
 */
class ValidationSchema {
  private fields = new Map<string, FieldDefinition>();

  /**
   * Adds a field definition to the schema
   *
   * @param name - Field name
   * @param definition - Field validation definition
   * @internal
   */
  addField(name: string, definition: FieldDefinition): void {
    this.fields.set(name, definition);
  }

  /**
   * Gets the internal field definitions map
   *
   * @returns Map of field names to their definitions
   * @internal
   */
  build(): Map<string, FieldDefinition> {
    return this.fields;
  }
}

/**
 * Creates a validation schema from a field definition object
 *
 * @param schemaDefinition - Object mapping field names to validators
 * @returns ValidationSchema instance
 *
 * @example
 * const userSchema = validator.schema({
 *   name: validator.string({ maxLength: 60 }),
 *   email: validator.email().required(),
 *   age: validator.number({ min: 18 })
 * })
 */
export const schema = (
  schemaDefinition: Record<string, BaseValidationRule>,
): Map<string, FieldDefinition> => {
  const schema = new ValidationSchema();

  for (const [fieldName, validator] of Object.entries(schemaDefinition)) {
    schema.addField(fieldName, {
      rules: validator.rules,
      optional: validator.hasOptional,
      defaultValue: validator.defaultValue,
    });
  }

  return schema.build();
};

// Export a singleton instance for convenience
export const v = new Validator();
