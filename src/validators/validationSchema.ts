import type {
  CompiledRequestValidationSchema,
  FieldDefinition,
  RequestValidationSchema,
  RuleOptions,
} from "./types";
import { BaseValidationRule } from "./validationRule";
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
  ObjectRule,
  BigIntRule,
  UnionRule,
} from "./rules";
import { Validator } from "./validator";
import type { Middleware } from "../types";
import { ConvertPrimitiveRule } from "./rules/convertPrimitiveRule";

/**
 * Factory responsible for creating **conversion-aware validation rules**
 * for primitive JavaScript types.
 *
 * Each method returns a `BaseValidationRule<T>` that performs two steps:
 *
 * 1. **Coercion / conversion** – transforms the incoming value into the
 *    expected primitive type.
 * 2. **Validation** – verifies that the converted value is a valid instance
 *    of that type.
 *
 * This factory is typically used in request validation pipelines where
 * incoming values (often strings from HTTP requests) must be **normalized
 * and validated simultaneously**. For example:
 *
 * - Query parameters `"42"` → `number`
 * - Query parameters `"true"` → `boolean`
 * - JSON timestamps → `Date`
 *
 * By combining conversion and validation into a single rule, the system
 * avoids the need for separate parsing and validation layers.
 *
 * This approach ensures that request values are converted to the correct
 * runtime type before additional validation rules are applied.
 */
class ConvertFactory {
  /**
   * Creates a rule that converts a value to a **string** and validates it.
   *
   * @param message - Optional custom validation error message.
   * @returns A string conversion and validation rule.
   */
  string(message?: string): BaseValidationRule<string> {
    return new ConvertPrimitiveRule<string>(
      "string",
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      value => String(value),
      value => typeof value === "string",
      message || "must be a string",
    );
  }

  /**
   * Creates a rule that converts a value to a **number** and validates it.
   *
   * Conversion behavior:
   * - Uses the `Number(...)` constructor for coercion.
   *
   * @param message - Optional custom validation error message.
   * @returns A number conversion and validation rule.
   */
  number(message?: string): BaseValidationRule<number> {
    return new ConvertPrimitiveRule<number>(
      "number",
      value => Number(value),
      value => typeof value === "number" && !Number.isNaN(value),
      message || "must be a number",
    );
  }

  /**
   * Creates a rule that converts a value to a **boolean** and validates it.
   *
   * Validation:
   * - Ensures the resulting value is of type `boolean`.
   *
   * @param message - Optional custom validation error message.
   * @returns A boolean conversion and validation rule.
   */
  boolean(message?: string): BaseValidationRule<boolean> {
    return new ConvertPrimitiveRule<boolean>(
      "boolean",
      value => {
        if (typeof value === "string") {
          const normalized = value.trim().toLowerCase();
          if (normalized === "true" || normalized === "1") return true;
          if (normalized === "false" || normalized === "0") return false;
        }

        if (typeof value === "number") {
          if (value === 1) return true;
          if (value === 0) return false;
        }

        return Boolean(value);
      },
      value => typeof value === "boolean",
      message || "must be a boolean",
    );
  }

  /**
   * Creates a rule that converts a value to a **bigint** and validates it.
   *
   * @param message - Optional custom validation error message.
   * @returns A bigint conversion and validation rule.
   */
  bigint(message?: string): BaseValidationRule<bigint> {
    return new ConvertPrimitiveRule<bigint>(
      "bigint",
      value => BigInt(value as string | number | bigint | boolean),
      value => typeof value === "bigint",
      message || "must be a bigint",
    );
  }

  /**
   * Creates a rule that converts a value to a **Date** instance and validates it.
   *
   * @param message - Optional custom validation error message.
   * @returns A date conversion and validation rule.
   */
  date(message?: string): BaseValidationRule<Date> {
    return new ConvertPrimitiveRule<Date>(
      "date",
      value => new Date(value as string | number | Date),
      value => value instanceof Date && !Number.isNaN(value.getTime()),
      message || "must be a valid date",
    );
  }
}

/**
 * Main validator class - provides factory methods for creating validators
 */
class ValidatorRules {
  readonly convert = new ConvertFactory();

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
   * Creates a bigint validator.
   *
   * @param message - Optional custom error message
   * @returns BigIntRule instance
   *
   * @example
   * validator.bigint()
   */
  bigint(message?: string): BigIntRule {
    const bigIntRule = new BigIntRule();
    bigIntRule.rules.push({ rule: bigIntRule, options: { message } });
    return bigIntRule;
  }

  /**
   * Creates a boolean validator
   *
   * @param message - Optional custom error message
   * @returns BooleanValidator instance
   *
   * @example
   * validator.boolean()
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
   * Creates an object validator with a nested schema.
   *
   * @param objectSchemaDefinition - Record mapping field names to their validators
   * @param options - Optional rule options (message, etc.)
   * @returns ObjectRule instance
   *
   * @example
   * validator.object({
   *   id: validator.number(),
   *   name: validator.string({ maxLength: 100 })
   * })
   */
  object(
    objectSchemaDefinition: Record<string, BaseValidationRule>,
    options?: RuleOptions,
  ): ObjectRule {
    const objectSchema = compileFieldSchema(objectSchemaDefinition);
    const objectRule = new ObjectRule(objectSchema);

    objectRule.rules.push({ rule: objectRule, options });
    return objectRule;
  }

  /**
   * Creates a union validator that passes if any of the supplied rules pass.
   *
   * @param unionRules - Array of validation rules to try in order
   * @param options - Optional rule options (message, etc.)
   * @returns UnionRule instance
   *
   * @example
   * validator.union([
   *   validator.string(),
   *   validator.number()
   * ])
   */
  union(unionRules: BaseValidationRule[], options?: RuleOptions): UnionRule {
    const unionRule = new UnionRule(unionRules);
    unionRule.rules.push({ rule: unionRule, options });
    return unionRule;
  }

  /**
   * Creates a literal value validator
   *
   * @param value - The literal value to validate against
   * @param message - Optional custom error message
   * @returns LiteralRule instance
   *
   * @example
   * validator.literal("admin")
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
 * const userSchema = schema({
 *   body: {
 *     name: v.string({ maxLength: 60 }),
 *     email: v.string().email(),
 *     age: v.number({ min: 18 }),
 *     active: v.boolean().default(true),
 *   },
 *   params: {
 *     id: v.string().uuid()
 *   }
 * })
 */
export const schema = (
  schemaDefinition: RequestValidationSchema,
): CompiledRequestValidationSchema => {
  const compiledFields = {} as CompiledRequestValidationSchema;

  if (schemaDefinition.body) {
    compiledFields.body = compileFieldSchema(schemaDefinition.body);
  }

  if (schemaDefinition.params) {
    compiledFields.params = compileFieldSchema(schemaDefinition.params);
  }

  if (schemaDefinition.query) {
    compiledFields.query = compileFieldSchema(schemaDefinition.query);
  }

  return compiledFields;
};

/**
 * Compiles a plain field validation definition into an optimized schema structure.
 *
 * This helper transforms a developer-defined object mapping field names to
 * `BaseValidationRule` instances into a compiled `Map<string, FieldDefinition>`
 * using the internal `ValidationSchema` builder.
 *
 * The resulting `Map` is intended for **runtime validation**, where faster lookups
 * and a normalized structure improve performance and simplify the validation logic.
 *
 * @param schemaDefinition - Object mapping field names to their validation rules.
 * @returns A compiled map of field definitions ready for validation.
 */
function compileFieldSchema(
  schemaDefinition: Record<string, BaseValidationRule>,
): Map<string, FieldDefinition> {
  const schema = new ValidationSchema();

  for (const [fieldName, validator] of Object.entries(schemaDefinition)) {
    schema.addField(fieldName, {
      rules: validator.rules,
      optional: validator.hasOptional,
      defaultValue: validator.defaultValue,
      converter: validator.converter,
    });
  }

  return schema.build();
}

// Export a singleton instance for convenience
export const v = new ValidatorRules();

/**
 * Validates the request payload against a validation schema.
 *
 * Throws if validation fails.
 *
 * @param schema - Validation rules mapped by field name
 */
export const validateRequest = (
  schema: CompiledRequestValidationSchema,
): Middleware => {
  return (request, next) => {
    if (schema.body) {
      const validBody = Validator.validateOrFail(request.body, schema.body);
      request.setBody(validBody);
    }

    if (schema.params) {
      const validParams = Validator.validateOrFail(
        request.params,
        schema.params,
      );
      request.setParams(validParams);
    }

    if (schema.query) {
      const validQuery = Validator.validateOrFail(request.query, schema.query);
      request.setQuery(validQuery);
    }

    return next(request);
  };
};
