import {
  HelperArgumentException,
  HelperExecutionException,
  HelperNotFoundException,
} from "../../src/exceptions/helperExceptions";
import { HelpersManager } from "../../src/views/helpersTemplate";

describe("HelpersManager", () => {
  let manager: HelpersManager;

  const context = {
    user: {
      name: "Juan",
      age: 30,
    },
    price: 199.9,
    this: {
      name: "Item",
    },
  };

  const resolveValue = (path: string, ctx: any): unknown => {
    return path.split(".").reduce((acc, key) => acc?.[key], ctx);
  };

  beforeEach(() => {
    manager = new HelpersManager();
  });

  describe("helper registration", () => {
    it("should correctly register and retrieve a custom helper", () => {
      const fn = jest.fn(() => "ok");

      manager.register("test", fn);

      expect(manager.has("test")).toBe(true);
      expect(manager.get("test")).toBe(fn);
    });

    it("should properly remove a registered helper", () => {
      manager.register("removeMe", () => "bye");

      expect(manager.remove("removeMe")).toBe(true);
      expect(manager.has("removeMe")).toBe(false);
    });

    it("should safely return false when removing a non existing helper", () => {
      expect(manager.remove("unknown")).toBe(false);
    });

    it("should completely clear all registered helpers", () => {
      manager.register("a", () => "a");
      manager.register("b", () => "b");

      manager.clear();

      expect(manager.getRegisteredHelpers()).toHaveLength(0);
    });
  });

  describe("default helpers", () => {
    it("should automatically register all default helpers", () => {
      const helpers = manager.getRegisteredHelpers();

      expect(helpers).toEqual(
        expect.arrayContaining([
          "date",
          "upper",
          "lower",
          "truncate",
          "currency",
        ]),
      );
    });

    it("should correctly execute the upper helper", () => {
      const result = manager.execute(
        "upper",
        "user.name",
        context,
        resolveValue,
      );

      expect(result).toBe(context.user.name.toUpperCase());
    });

    it("should correctly execute the currency helper", () => {
      const result = manager.execute(
        "currency",
        "price",
        context,
        resolveValue,
      );

      expect(result).toBe("$199.90");
    });
  });

  describe("argument parsing", () => {
    it("should properly parse strings numbers booleans and null values", () => {
      const args = manager.parseArgs(
        `"hello" 123 true false null`,
        context,
        resolveValue,
        "test",
      );

      expect(args).toEqual(["hello", 123, true, false, null]);
    });

    it("should correctly resolve context paths as arguments", () => {
      const args = manager.parseArgs(
        "user.name user.age this.name",
        context,
        resolveValue,
        "test",
      );

      expect(args).toEqual(["Juan", 30, "Item"]);
    });

    it("should explicitly throw when an argument cannot be resolved", () => {
      expect(() =>
        manager.parseArgs("user.notExists", context, resolveValue, "test"),
      ).toThrow(HelperArgumentException);
    });
  });

  describe("helper execution", () => {
    it("should successfully execute a custom helper", () => {
      manager.register("concat", (a: string, b: string) => a + b);

      const result = manager.execute(
        "concat",
        `"Hello " user.name`,
        context,
        resolveValue,
      );

      expect(result).toBe("Hello Juan");
    });

    it("should explicitly throw when helper does not exist", () => {
      expect(() =>
        manager.execute("nope", "123", context, resolveValue),
      ).toThrow(HelperNotFoundException);
    });

    it("should safely throw when helper execution fails", () => {
      manager.register("boom", () => {
        throw new Error("fail");
      });

      expect(() => manager.execute("boom", "", context, resolveValue)).toThrow(
        HelperExecutionException,
      );
    });
  });
});
