import {
  BooleanRule,
  DateRule,
  EmailRule,
  NumberRule,
  RequiredRule,
  StringRule,
} from "../../src/validators/index";

describe("RulesTest", () => {
  describe("RequiredRuleTest", () => {
    let requiredRule: RequiredRule;

    beforeEach(() => {
      requiredRule = new RequiredRule();
    });

    it("should normally pass when value is present", () => {
      const context = {
        field: "name",
        value: "Juan",
        data: {
          name: "Juan",
        },
      };
      const result = requiredRule.validate(context);

      expect(result).toBeNull();
    });

    it("should properly fail when value is missing", () => {
      const context = {
        field: "name",
        value: undefined,
        data: {
          name: undefined,
        },
      };

      const result = requiredRule.validate(context);

      expect(result).not.toBeNull();
    });
  });

  describe("StringRule", () => {
    let rule: StringRule;

    const options = {
      minLength: 3,
      maxLength: 20,
      pattern: /^\p{L}+$/u,
    };

    beforeEach(() => {
      rule = new StringRule();
    });

    it("should successfully validate when value is a string", () => {
      const context = {
        field: "name",
        value: "Juan",
        data: { name: "Juan" },
      };

      const result = rule.validate(context);

      expect(result).toBeNull();
    });

    it("should correctly fail when value is not a string", () => {
      const context = {
        field: "name",
        value: 9,
        data: { name: 9 },
      };

      const result = rule.validate(context);

      expect(result).not.toBeNull();
    });

    it("should correctly fail when value is a boolean", () => {
      const context = {
        field: "last_name",
        value: true,
        data: { last_name: true },
      };

      const result = rule.validate(context);

      expect(result).not.toBeNull();
    });

    it("should successfully validate when all options are satisfied", () => {
      const context = {
        field: "name",
        value: "Juan",
        data: { name: "Juan" },
      };

      const result = rule.validate(context, options);

      expect(result).toBeNull();
    });

    it("should correctly fail when value is shorter than minLength", () => {
      const context = {
        field: "name",
        value: "Ju",
        data: { name: "Ju" },
      };

      const result = rule.validate(context, options);

      expect(result).not.toBeNull();
    });

    it("should correctly fail when value exceeds maxLength", () => {
      const context = {
        field: "name",
        value: "soy-el-nombre-mas-largo-del-mundo",
        data: {
          name: "soy-el-nombre-mas-largo-del-mundo",
        },
      };

      const result = rule.validate(context, options);

      expect(result).not.toBeNull();
    });

    it("should correctly fail when value does not match pattern", () => {
      const context = {
        field: "name",
        value: "3123123213fd",
        data: { name: "3123123213fd" },
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
        data: {
          name: true,
        },
      };

      const context2 = {
        field: "active",
        value: "true",
        data: {
          name: "true",
        },
      };
      const result = booleanRule.validate(context);
      const result2 = booleanRule.validate(context2);

      expect(result).toBeNull();
      expect(result2).toBeNull();
    });

    it("should properly fail when value is not boolean", () => {
      const context = {
        field: "active",
        value: 32,
        data: {
          name: 32,
        },
      };

      const context2 = {
        field: "active",
        value: "hola",
        data: {
          name: "hola",
        },
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
        data: {},
      };

      const result = numbreRule.validate(context);

      expect(result).toBeNull();
    });

    it("should properly convert numeric strings to numbers", () => {
      const context = {
        field: "age",
        value: "30",
        data: {},
      };

      const result = numbreRule.validate(context);

      expect(result).toBeNull();
    });

    it("should correctly fail when value is not a number", () => {
      const context = {
        field: "age",
        value: "abc",
        data: {},
      };

      const result = numbreRule.validate(context);

      expect(result).not.toBeNull();
    });

    it("should correctly fail when integer option is enabled and value is decimal", () => {
      const context = {
        field: "count",
        value: 10.5,
        data: {},
      };

      const result = numbreRule.validate(context, { integer: true });

      expect(result).not.toBeNull();
    });

    it("should correctly fail when positive option is enabled and value is zero", () => {
      const context = {
        field: "price",
        value: -1,
        data: {},
      };

      const result = numbreRule.validate(context, { positive: true });

      expect(result).not.toBeNull();
    });

    it("should correctly fail when value is lower than min option", () => {
      const context = {
        field: "quantity",
        value: 3,
        data: {},
      };

      const result = numbreRule.validate(context, { min: 5 });

      expect(result).not.toBeNull();
    });

    it("should correctly fail when value is greater than max option", () => {
      const context = {
        field: "quantity",
        value: 20,
        data: {},
      };

      const result = numbreRule.validate(context, { max: 10 });

      expect(result).not.toBeNull();
    });

    it("should successfully validate number within min and max range", () => {
      const context = {
        field: "quantity",
        value: 7,
        data: {},
      };

      const result = numbreRule.validate(context, { min: 5, max: 10 });

      expect(result).toBeNull();
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
        data: {},
      };

      const result = dateRule.validate(context);

      expect(result).toBeNull();
    });

    it("should correctly validate a valid date string", () => {
      const context = {
        field: "birthDate",
        value: "2024-01-01",
        data: {},
      };

      const result = dateRule.validate(context);

      expect(result).toBeNull();
    });

    it("should correctly validate a valid timestamp number", () => {
      const context = {
        field: "createdAt",
        value: Date.now(),
        data: {},
      };

      const result = dateRule.validate(context);

      expect(result).toBeNull();
    });

    it("should correctly fail when value is not a date-compatible type", () => {
      const context = {
        field: "startDate",
        value: { year: 2024 },
        data: {},
      };

      const result = dateRule.validate(context);

      expect(result).not.toBeNull();
    });

    it("should correctly fail when date string is invalid", () => {
      const context = {
        field: "startDate",
        value: "invalid-date",
        data: {},
      };

      const result = dateRule.validate(context);

      expect(result).not.toBeNull();
    });

    it("should correctly fail when date is before min option", () => {
      const context = {
        field: "eventDate",
        value: "2023-01-01",
        data: {},
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
        data: {},
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
        data: {},
      };

      const result = dateRule.validate(context, {
        min: "2024-01-01",
        max: "2024-12-31",
      });

      expect(result).toBeNull();
    });
  });

  describe("EmailRuleTest", () => {
    let rule: EmailRule;

    beforeEach(() => {
      rule = new EmailRule();
    });

    it("should successfully validate when value is a valid email string", () => {
      const context = {
        field: "email",
        value: "juan@example.com",
        data: { email: "juan@example.com" },
      };

      const result = rule.validate(context);

      expect(result).toBeNull();
    });

    it("should correctly fail when value is not a string", () => {
      const context = {
        field: "email",
        value: 123,
        data: { email: 123 },
      };

      const result = rule.validate(context);

      expect(result).not.toBeNull();
    });

    it("should correctly fail when email format is invalid", () => {
      const context = {
        field: "email",
        value: "invalid-email",
        data: { email: "invalid-email" },
      };

      const result = rule.validate(context);

      expect(result).not.toBeNull();
    });

    it("should correctly fail when email is missing domain", () => {
      const context = {
        field: "email",
        value: "juan@",
        data: { email: "juan@" },
      };

      const result = rule.validate(context);

      expect(result).not.toBeNull();
    });

    it("should correctly fail when email is missing username", () => {
      const context = {
        field: "email",
        value: "@example.com",
        data: { email: "@example.com" },
      };

      const result = rule.validate(context);

      expect(result).not.toBeNull();
    });

    it("should properly return custom error message when provided", () => {
      const context = {
        field: "email",
        value: "invalid-email",
        data: { email: "invalid-email" },
      };

      const options = {
        message: "email format is incorrect",
      };

      const result = rule.validate(context, options);

      expect(result).not.toBeNull();
      expect(result?.message).toBe("email format is incorrect");
    });
  });
});
