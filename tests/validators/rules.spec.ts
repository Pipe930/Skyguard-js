import { schema, v } from "../../src/validators/validationSchema";
import {
  ArrayRule,
  BooleanRule,
  DateRule,
  NumberRule,
  ObjectRule,
  StringRule,
  UnionRule,
  BigIntRule,
} from "../../src/validators/index";

describe("RulesTest", () => {
  describe("StringRule", () => {
    let rule: StringRule;
    beforeEach(() => {
      rule = new StringRule();
    });

    it("should successfully validate when value is a string", () => {
      const context = {
        field: "name",
        value: "Juan",
      };

      const result = rule.validate(context);

      expect(result).toBeNull();
    });

    it("should correctly fail when value is not a string", () => {
      const context = {
        field: "name",
        value: 9,
      };

      const result = rule.validate(context);

      expect(result).not.toBeNull();
    });

    it("should correctly fail when value is a boolean", () => {
      const context = {
        field: "last_name",
        value: true,
      };

      const result = rule.validate(context);

      expect(result).not.toBeNull();
    });

    it("should successfully validate when all options are satisfied", () => {
      const options = {
        minLength: 3,
        maxLength: 20,
      };

      const context = {
        field: "name",
        value: "Juan",
      };

      const result = rule.validate(context, options);

      expect(result).toBeNull();
    });

    it("should correctly fail when value is shorter than minLength", () => {
      const options = {
        minLength: 3,
        maxLength: 20,
      };
      const context = {
        field: "name",
        value: "Ju",
      };

      const result = rule.validate(context, options);

      expect(result).not.toBeNull();
    });

    it("should correctly fail when value exceeds maxLength", () => {
      const options = {
        minLength: 3,
        maxLength: 20,
      };
      const context = {
        field: "name",
        value: "soy-el-nombre-mas-largo-del-mundo",
      };

      const result = rule.validate(context, options);

      expect(result).not.toBeNull();
    });

    it("should correctly fail when value don't exact length", () => {
      const options = {
        length: 10,
      };
      const context = {
        field: "name",
        value: "3123123213fd",
      };

      const result = rule.validate(context, options);

      expect(result).not.toBeNull();
    });
  });

  describe("BooleanRuleTest", () => {
    let booleanRule: BooleanRule;

    beforeEach(() => {
      booleanRule = new BooleanRule();
    });

    it("should correctly pass when value is boolean", () => {
      const context = {
        field: "active",
        value: true,
      };
      const result = booleanRule.validate(context);

      expect(result).toBeNull();
    });

    it("should properly fail when value is not boolean", () => {
      const context = {
        field: "active",
        value: 32,
      };

      const context2 = {
        field: "active",
        value: "hola",
      };

      const result = booleanRule.validate(context);
      const result2 = booleanRule.validate(context2);

      expect(result).not.toBeNull();
      expect(result2).not.toBeNull();
    });
  });

  describe("NumberRuleTest", () => {
    let numbreRule: NumberRule;

    beforeEach(() => {
      numbreRule = new NumberRule();
    });

    it("should successfully validate a valid number", () => {
      const context = {
        field: "age",
        value: 25,
      };

      const result = numbreRule.validate(context);

      expect(result).toBeNull();
    });

    it("should correctly fail when value is not a number", () => {
      const context = {
        field: "age",
        value: "abc",
      };

      const result = numbreRule.validate(context);

      expect(result).not.toBeNull();
    });

    it("should correctly fail when integer option is enabled and value is decimal", () => {
      const context = {
        field: "count",
        value: 10.5,
      };

      const result = numbreRule.validate(context, { integer: true });

      expect(result).not.toBeNull();
    });

    it("should correctly fail when positive option is enabled and value is zero", () => {
      const context = {
        field: "price",
        value: -1,
      };

      const result = numbreRule.validate(context, { positive: true });

      expect(result).not.toBeNull();
    });

    it("should correctly fail when value is lower than min option", () => {
      const context = {
        field: "quantity",
        value: 3,
      };

      const result = numbreRule.validate(context, { min: 5 });

      expect(result).not.toBeNull();
    });

    it("should correctly fail when value is greater than max option", () => {
      const context = {
        field: "quantity",
        value: 20,
      };

      const result = numbreRule.validate(context, { max: 10 });

      expect(result).not.toBeNull();
    });

    it("should successfully validate number within min and max range", () => {
      const context = {
        field: "quantity",
        value: 7,
      };

      const result = numbreRule.validate(context, { min: 5, max: 10 });

      expect(result).toBeNull();
    });
  });

  describe("BigIntRuleTest", () => {
    let bigIntRule: BigIntRule;

    beforeEach(() => {
      bigIntRule = new BigIntRule();
    });

    it("should successfully validate a valid bigint", () => {
      const context = { field: "amount", value: 10n };

      const result = bigIntRule.validate(context);

      expect(result).toBeNull();
    });

    it("should correctly fail when value is not a bigint", () => {
      const context = { field: "amount", value: 10 };

      const result = bigIntRule.validate(context);

      expect(result).not.toBeNull();
    });

    it("should validate gt option", () => {
      const ctxOk = { field: "n", value: 6n };
      const ctxFail = { field: "n", value: 5n };

      expect(bigIntRule.validate(ctxOk, { gt: 5n })).toBeNull();
      expect(bigIntRule.validate(ctxFail, { gt: 5n })).not.toBeNull();
    });

    it("should validate gte/lt/lte option", () => {
      expect(
        bigIntRule.validate({ field: "n", value: 5n }, { gte: 5n }),
      ).toBeNull();
      expect(
        bigIntRule.validate({ field: "n", value: 4n }, { gte: 5n }),
      ).not.toBeNull();
      expect(
        bigIntRule.validate({ field: "n", value: 4n }, { lt: 5n }),
      ).toBeNull();
      expect(
        bigIntRule.validate({ field: "n", value: 5n }, { lt: 5n }),
      ).not.toBeNull();
      expect(
        bigIntRule.validate({ field: "n", value: 5n }, { lte: 5n }),
      ).toBeNull();
    });

    it("should validate positive and negative options", () => {
      expect(
        bigIntRule.validate({ field: "n", value: 1n }, { positive: true }),
      ).toBeNull();
      expect(
        bigIntRule.validate({ field: "n", value: 0n }, { positive: true }),
      ).not.toBeNull();
      expect(
        bigIntRule.validate({ field: "n", value: -1n }, { negative: true }),
      ).toBeNull();
      expect(
        bigIntRule.validate({ field: "n", value: 0n }, { negative: true }),
      ).not.toBeNull();
    });
  });

  describe("DateRuleTest", () => {
    let dateRule: DateRule;

    beforeEach(() => {
      dateRule = new DateRule();
    });

    it("should successfully validate a valid Date instance", () => {
      const context = {
        field: "birthDate",
        value: new Date("2024-01-01"),
      };

      const result = dateRule.validate(context);

      expect(result).toBeNull();
    });

    it("should correctly validate a valid date string", () => {
      const context = {
        field: "birthDate",
        value: "2024-01-01",
      };

      const result = dateRule.validate(context);

      expect(result).toBeNull();
    });

    it("should correctly validate a valid timestamp number", () => {
      const context = {
        field: "createdAt",
        value: Date.now(),
      };

      const result = dateRule.validate(context);

      expect(result).toBeNull();
    });

    it("should correctly fail when value is not a date-compatible type", () => {
      const context = {
        field: "startDate",
        value: { year: 2024 },
      };

      const result = dateRule.validate(context);

      expect(result).not.toBeNull();
    });

    it("should correctly fail when date string is invalid", () => {
      const context = {
        field: "startDate",
        value: "invalid-date",
      };

      const result = dateRule.validate(context);

      expect(result).not.toBeNull();
    });

    it("should correctly fail when date is before min option", () => {
      const context = {
        field: "eventDate",
        value: "2023-01-01",
      };

      const result = dateRule.validate(context, {
        min: "2024-01-01",
      });

      expect(result).not.toBeNull();
    });

    it("should correctly fail when date is after max option", () => {
      const context = {
        field: "eventDate",
        value: "2025-01-01",
      };

      const result = dateRule.validate(context, {
        max: "2024-12-31",
      });

      expect(result).not.toBeNull();
    });

    it("should successfully validate date within min and max range", () => {
      const context = {
        field: "eventDate",
        value: "2024-06-01",
      };

      const result = dateRule.validate(context, {
        min: "2024-01-01",
        max: "2024-12-31",
      });

      expect(result).toBeNull();
    });
  });

  describe("ObjectRuleTest", () => {
    it("should validate nested object schema", () => {
      const roleSchema = schema({
        name: v.string().regex(/^[0-9a-z]+$/),
        permission: v.object({
          name: v.string().regex(/^[0-9a-z]+$/),
          action: v.literal("manager"),
        }),
      });

      const rule = new ObjectRule(roleSchema);
      const result = rule.validate({
        field: "role",
        value: {
          name: "admin1",
          permission: {
            name: "users",
            action: "manager",
          },
        },
      });

      expect(result).toBeNull();
    });

    it("should include nested path when nested object fails", () => {
      const roleSchema = schema({
        name: v.string(),
        permission: v.object({
          name: v.string(),
          action: v.literal("manager"),
        }),
      });

      const rule = new ObjectRule(roleSchema);
      const result = rule.validate({
        field: "role",
        value: {
          name: "admin",
          permission: {
            name: "users",
            action: "editor",
          },
        },
      });

      expect(result).not.toBeNull();
      expect(result?.field).toBe("role.permission.action");
    });
  });

  describe("ArrayRuleTest", () => {
    it("should validate all chained item rules", () => {
      const itemRule = v.string().regex(/^[a-z]+$/);
      const rule = new ArrayRule(itemRule);

      const result = rule.validate({
        field: "tags",
        value: ["alpha", "beta"],
      });

      expect(result).toBeNull();
    });

    it("should fail using nested item path when one array item is invalid", () => {
      const itemRule = v.string().regex(/^[a-z]+$/);
      const rule = new ArrayRule(itemRule);

      const result = rule.validate({
        field: "tags",
        value: ["alpha", "BETA"],
      });

      expect(result).not.toBeNull();
      expect(result?.field).toBe("tags[1]");
    });
  });

  describe("UnionRuleTest", () => {
    it("should pass when one rule in union matches", () => {
      const rule = new UnionRule([v.number(), v.boolean()]);

      const numberResult = rule.validate({
        field: "active",
        value: 10,
      });

      const booleanResult = rule.validate({
        field: "active",
        value: false,
      });

      expect(numberResult).toBeNull();
      expect(booleanResult).toBeNull();
    });

    it("should fail when no union rules match", () => {
      const rule = new UnionRule([v.number(), v.boolean()]);

      const result = rule.validate({
        field: "active",
        value: "enabled",
      });

      expect(result).not.toBeNull();
      expect(result?.field).toBe("active");
      expect(result?.rule).toBe("union");
    });

    it("should validate union members with chained rules", () => {
      const rule = new UnionRule([
        v.string().regex(/^ok$/),
        v.number({ min: 5 }),
      ]);

      const validString = rule.validate({
        field: "state",
        value: "ok",
      });
      const validNumber = rule.validate({
        field: "state",
        value: 7,
      });
      const invalid = rule.validate({
        field: "state",
        value: 3,
      });

      expect(validString).toBeNull();
      expect(validNumber).toBeNull();
      expect(invalid).not.toBeNull();
    });
  });
});
