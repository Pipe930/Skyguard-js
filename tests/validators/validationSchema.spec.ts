import {
  NumberRule,
  RequiredRule,
  StringRule,
} from "../../src/validators/index";
import { validator } from "../../src/validators/validationSchema";

describe("ValidationSchemaTest", () => {
  it("should create a new ValidationSchema instance using create()", () => {
    const schema = validator.schema({});

    expect(schema).toEqual(expect.any(Map));
  });

  it("should create a field definition when field() is called", () => {
    const schema = validator.schema({
      name: validator.string(),
    });

    expect(schema.has("name")).toBe(true);
    expect(schema.get("name")).toEqual({
      rules: [
        {
          options: undefined,
          rule: expect.any(StringRule),
        },
      ],
      optional: false,
    });
  });

  it("should mark a field as required by default", () => {
    const schema = validator.schema({
      email: validator.string(),
    });

    expect(schema.get("email")?.optional).toBe(false);
  });

  it("should mark a field as optional when optional() is called", () => {
    const schema = validator.schema({
      bio: validator.string().optional(),
    });

    expect(schema.get("bio")?.optional).toBe(true);
  });

  it("should override optional flag when required() is called after optional()", () => {
    const schema = validator.schema({
      name: validator.string().optional().required(),
    });

    expect(schema.get("name")?.optional).toBe(false);
  });

  it("should register a string rule with options", () => {
    const schema = validator.schema({
      username: validator.string({ minLength: 3 }),
    });
    const rules = schema.get("username")?.rules;

    expect(rules).toHaveLength(1);
    expect(rules?.[0].rule).toBeInstanceOf(StringRule);
    expect(rules?.[0].options).toEqual({ minLength: 3 });
  });

  it("should register a number rule with options", () => {
    const schema = validator.schema({
      age: validator.number({ min: 18 }),
    });
    const rules = schema.get("age")?.rules;

    expect(rules).toHaveLength(1);
    expect(rules?.[0].rule).toBeInstanceOf(NumberRule);
    expect(rules?.[0].options).toEqual({ min: 18 });
  });

  it("should register a required rule with a custom message", () => {
    const schema = validator.schema({
      email: validator.string().required("Email is required"),
    });
    const rules = schema.get("email")?.rules;

    expect(rules).toHaveLength(2);
    expect(rules?.[1].rule).toBeInstanceOf(RequiredRule);
    expect(rules?.[1].options).toEqual({
      message: "Email is required",
    });
  });

  it("should register multiple rules in order for the same field", () => {
    const schema = validator.schema({
      email: validator.string().email().required(),
    });
    const rules = schema.get("email")?.rules;

    expect(rules).toHaveLength(3);
    expect(rules?.[0].rule).toBeInstanceOf(StringRule);
    expect(rules?.[2].rule).toBeInstanceOf(RequiredRule);
  });

  it("should support defining multiple independent fields", () => {
    const schema = validator.schema({
      name: validator.string(),
      age: validator.number({ min: 18 }),
    });

    expect(schema.has("name")).toBe(true);
    expect(schema.has("age")).toBe(true);
    expect(schema.get("name")?.rules[0].rule).toBeInstanceOf(StringRule);
    expect(schema.get("age")?.rules[0].rule).toBeInstanceOf(NumberRule);
  });
});
