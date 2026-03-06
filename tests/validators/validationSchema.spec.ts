import { NumberRule, ObjectRule, StringRule } from "../../src/validators/index";
import { EmailRule } from "../../src/validators/rules/stringRule";
import { v, schema } from "../../src/validators/validationSchema";

describe("Validation Schema Test", () => {
  it("should create a new ValidationSchema instance using create()", () => {
    const schemaTest = schema({});

    expect(schemaTest.body).toEqual(undefined);
    expect(schemaTest.params).toEqual(undefined);
    expect(schemaTest.query).toEqual(undefined);
  });

  it("should create a field definition when field() is called", () => {
    const schemaTest = schema({
      body: {
        name: v.string(),
      },
    });

    expect(schemaTest.body.has("name")).toBe(true);
    expect(schemaTest.body.get("name")).toEqual({
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
      body: {
        email: v.string(),
      },
    });

    expect(schemaTest.body.get("email")?.optional).toBe(false);
  });

  it("should mark a field as optional when optional() is called", () => {
    const schemaTest = schema({
      body: {
        biography: v.string().optional(),
      },
    });

    expect(schemaTest.body.get("biography")?.optional).toBe(true);
  });

  it("should register a string rule with options", () => {
    const schemaTest = schema({
      body: {
        username: v.string({ minLength: 3 }),
      },
    });
    const rules = schemaTest.body.get("username")?.rules;

    expect(rules).toHaveLength(1);
    expect(rules?.[0].rule).toBeInstanceOf(StringRule);
    expect(rules?.[0].options).toEqual({ minLength: 3 });
  });

  it("should register a number rule with options", () => {
    const schemaTest = schema({
      body: {
        age: v.number({ min: 18 }),
      },
    });
    const rules = schemaTest.body.get("age")?.rules;

    expect(rules).toHaveLength(1);
    expect(rules?.[0].rule).toBeInstanceOf(NumberRule);
    expect(rules?.[0].options).toEqual({ min: 18 });
  });

  it("should register multiple rules in order for the same field", () => {
    const schemaTest = schema({
      body: {
        email: v.string().email(),
      },
    });
    const rules = schemaTest.body.get("email")?.rules;

    expect(rules).toHaveLength(2);
    expect(rules?.[0].rule).toBeInstanceOf(StringRule);
    expect(rules?.[1].rule).toBeInstanceOf(EmailRule);
  });

  it("should support defining multiple independent fields", () => {
    const schemaTest = schema({
      body: {
        name: v.string(),
        age: v.number({ min: 18 }),
      },
    });

    expect(schemaTest.body.has("name")).toBe(true);
    expect(schemaTest.body.has("age")).toBe(true);
    expect(schemaTest.body.get("name")?.rules[0].rule).toBeInstanceOf(
      StringRule,
    );
    expect(schemaTest.body.get("age")?.rules[0].rule).toBeInstanceOf(
      NumberRule,
    );
  });

  it("should register an object rule with nested schema", () => {
    const schemaTest = schema({
      body: {
        role: v.object({
          name: v.string(),
        }),
      },
    });

    const rules = schemaTest.body.get("role")?.rules;

    expect(rules).toHaveLength(1);
    expect(rules?.[0].rule).toBeInstanceOf(ObjectRule);
  });

  it("should support deeply nested object definitions", () => {
    const schemaTest = schema({
      body: {
        role: v.object({
          name: v.string(),
          permission: v.object({
            name: v.string(),
            action: v.literal("manager"),
          }),
        }),
      },
    });

    expect(schemaTest.body.has("role")).toBe(true);
    expect(schemaTest.body.get("role")?.rules[0].rule).toBeInstanceOf(
      ObjectRule,
    );
  });

  it("should register number converter when convert.number() is used", () => {
    const schemaTest = schema({
      params: {
        id: v.convert.number(),
      },
    });

    expect(typeof schemaTest.params.get("id")?.converter).toBe("function");
  });
});
