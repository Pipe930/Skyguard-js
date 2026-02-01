import { ValidatorFieldException } from "../../src/exceptions";
import {
  EmailRule,
  NumberRule,
  RequiredRule,
  StringRule,
  ValidationRule,
  ValidationSchema,
} from "../../src/validators";

describe("ValidationSchemaTest", () => {
  it("should create a new ValidationSchema instance using create()", () => {
    const schema = ValidationSchema.create();

    expect(schema).toBeInstanceOf(ValidationSchema);
  });

  it("should create a field definition when field() is called", () => {
    const schema = ValidationSchema.create();
    const result = schema.field("name").build();

    expect(result.has("name")).toBe(true);
    expect(result.get("name")).toEqual({
      rules: [],
      optional: false,
    });
  });

  it("should mark a field as required by default", () => {
    const schema = ValidationSchema.create();
    const fields = schema.field("email").string().build();

    expect(fields.get("email")?.optional).toBe(false);
  });

  it("should mark a field as optional when optional() is called", () => {
    const schema = ValidationSchema.create();
    const fields = schema.field("bio").optional().string().build();

    expect(fields.get("bio")?.optional).toBe(true);
  });

  it("should override optional flag when required() is called after optional()", () => {
    const schema = ValidationSchema.create();
    const fields = schema.field("name").optional().required().string().build();

    expect(fields.get("name")?.optional).toBe(false);
  });

  it("should register a string rule with options", () => {
    const schema = ValidationSchema.create();
    const fields = schema.field("username").string({ minLength: 3 }).build();
    const rules = fields.get("username")?.rules;

    expect(rules).toHaveLength(1);
    expect(rules?.[0].rule).toBeInstanceOf(StringRule);
    expect(rules?.[0].options).toEqual({ minLength: 3 });
  });

  it("should register a number rule with options", () => {
    const schema = ValidationSchema.create();
    const fields = schema.field("age").number({ min: 18 }).build();
    const rules = fields.get("age")?.rules;

    expect(rules).toHaveLength(1);
    expect(rules?.[0].rule).toBeInstanceOf(NumberRule);
    expect(rules?.[0].options).toEqual({ min: 18 });
  });

  it("should register a required rule with a custom message", () => {
    const schema = ValidationSchema.create();
    const fields = schema.field("email").required("Email is required").build();
    const rules = fields.get("email")?.rules;

    expect(rules).toHaveLength(1);
    expect(rules?.[0].rule).toBeInstanceOf(RequiredRule);
    expect(rules?.[0].options).toEqual({
      message: "Email is required",
    });
  });

  it("should register multiple rules in order for the same field", () => {
    const schema = ValidationSchema.create();
    const fields = schema.field("email").required().string().email().build();
    const rules = fields.get("email")?.rules;

    expect(rules).toHaveLength(3);
    expect(rules?.[0].rule).toBeInstanceOf(RequiredRule);
    expect(rules?.[1].rule).toBeInstanceOf(StringRule);
    expect(rules?.[2].rule).toBeInstanceOf(EmailRule);
  });

  it("should support defining multiple independent fields", () => {
    const schema = ValidationSchema.create();

    const fields = schema
      .field("name")
      .string()
      .field("age")
      .number({ min: 18 })
      .build();

    expect(fields.has("name")).toBe(true);
    expect(fields.has("age")).toBe(true);
    expect(fields.get("name")?.rules[0].rule).toBeInstanceOf(StringRule);
    expect(fields.get("age")?.rules[0].rule).toBeInstanceOf(NumberRule);
  });

  it("should register a custom validation rule", () => {
    const schema = ValidationSchema.create();
    const customRule: ValidationRule = {
      name: "custom",
      validate: jest.fn().mockReturnValue(null),
    };

    const fields = schema
      .field("code")
      .custom(customRule, { message: "Invalid code" })
      .build();

    const rules = fields.get("code")?.rules;

    expect(rules).toHaveLength(1);
    expect(rules?.[0].rule).toBe(customRule);
    expect(rules?.[0].options).toEqual({
      message: "Invalid code",
    });
  });

  it("should throw ValidatorFieldException when calling rule without field()", () => {
    const schema = ValidationSchema.create();

    expect(() => schema.string()).toThrow(ValidatorFieldException);
  });

  it("should throw ValidatorFieldException when calling optional() without field()", () => {
    const schema = ValidationSchema.create();

    expect(() => schema.optional()).toThrow(ValidatorFieldException);
  });

  it("should throw ValidatorFieldException when calling required() without field()", () => {
    const schema = ValidationSchema.create();

    expect(() => schema.required()).toThrow(ValidatorFieldException);
  });
});
