import { NumberRule, ObjectRule, StringRule } from "../../src/validators/index";
import { EmailRule } from "../../src/validators/rules/stringRule";
import { v, schema } from "../../src/validators/validationSchema";

describe("ValidationSchemaTest", () => {
  it("should create a new ValidationSchema instance using create()", () => {
    const schemaTest = schema({});

    expect(schemaTest).toEqual(expect.any(Map));
  });

  it("should create a field definition when field() is called", () => {
    const schemaTest = schema({
      name: v.string(),
    });

    expect(schemaTest.has("name")).toBe(true);
    expect(schemaTest.get("name")).toEqual({
      rules: [
        {
          options: undefined,
          rule: expect.any(StringRule) as StringRule,
        },
      ],
      optional: false,
    });
  });

  it("should mark a field as required by default", () => {
    const schemaTest = schema({
      email: v.string(),
    });

    expect(schemaTest.get("email")?.optional).toBe(false);
  });

  it("should mark a field as optional when optional() is called", () => {
    const schemaTest = schema({
      bio: v.string().optional(),
    });

    expect(schemaTest.get("bio")?.optional).toBe(true);
  });

  it("should register a string rule with options", () => {
    const schemaTest = schema({
      username: v.string({ minLength: 3 }),
    });
    const rules = schemaTest.get("username")?.rules;

    expect(rules).toHaveLength(1);
    expect(rules?.[0].rule).toBeInstanceOf(StringRule);
    expect(rules?.[0].options).toEqual({ minLength: 3 });
  });

  it("should register a number rule with options", () => {
    const schemaTest = schema({
      age: v.number({ min: 18 }),
    });
    const rules = schemaTest.get("age")?.rules;

    expect(rules).toHaveLength(1);
    expect(rules?.[0].rule).toBeInstanceOf(NumberRule);
    expect(rules?.[0].options).toEqual({ min: 18 });
  });

  it("should register multiple rules in order for the same field", () => {
    const schemaTest = schema({
      email: v.string().email(),
    });
    const rules = schemaTest.get("email")?.rules;

    expect(rules).toHaveLength(2);
    expect(rules?.[0].rule).toBeInstanceOf(StringRule);
    expect(rules?.[1].rule).toBeInstanceOf(EmailRule);
  });

  it("should support defining multiple independent fields", () => {
    const schemaTest = schema({
      name: v.string(),
      age: v.number({ min: 18 }),
    });

    expect(schemaTest.has("name")).toBe(true);
    expect(schemaTest.has("age")).toBe(true);
    expect(schemaTest.get("name")?.rules[0].rule).toBeInstanceOf(StringRule);
    expect(schemaTest.get("age")?.rules[0].rule).toBeInstanceOf(NumberRule);
  });

  it("should register an object rule with nested schema", () => {
    const schemaTest = schema({
      role: v.object({
        name: v.string(),
      }),
    });

    const rules = schemaTest.get("role")?.rules;

    expect(rules).toHaveLength(1);
    expect(rules?.[0].rule).toBeInstanceOf(ObjectRule);
  });

  it("should support deeply nested object definitions", () => {
    const schemaTest = schema({
      role: v.object({
        name: v.string(),
        permission: v.object({
          name: v.string(),
          action: v.literal("manager"),
        }),
      }),
    });

    expect(schemaTest.has("role")).toBe(true);
    expect(schemaTest.get("role")?.rules[0].rule).toBeInstanceOf(ObjectRule);
  });
});
