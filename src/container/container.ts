import type { Constructor } from "../types";

/**
 * Dependency Injection container.
 *
 * Stores and resolves application-wide singletons by constructor reference.
 *
 * @example
 * class App {}
 *
 * // Create (or return) the singleton instance
 * const app = Container.singleton(App);
 *
 * // Resolve an already-registered singleton
 * const resolved = Container.resolve(App);
 */
export class Container {
  /**
   * Singleton instances indexed by class constructor.
   *
   * @internal
   */
  private static instances = new Map<Constructor, any>();

  /**
   * Get or create a singleton instance for the given class.
   *
   * If no instance exists yet, the container will instantiate the class with
   * `new classConstructor()` (no constructor arguments) and cache it.
   *
   * @typeParam T - Instance type produced by the constructor
   * @param classConstructor - Class constructor used as the registration key
   * @returns The singleton instance for the given class
   *
   * @example
   * class Database {
   *   connect() {
   *     console.log("Connected");
   *   }
   * }
   *
   * const db1 = Container.singleton(Database);
   * const db2 = Container.singleton(Database);
   * console.log(db1 === db2); // true
   */
  public static singleton<T>(classConstructor: Constructor<T>): T {
    if (!this.instances.has(classConstructor)) {
      const instance = new classConstructor();
      this.instances.set(classConstructor, instance);
    }

    return this.instances.get(classConstructor) as T;
  }

  /**
   * Resolve a previously created singleton instance.
   *
   * This method does not create instances. If the class was never registered
   * via {@link Container.singleton}, it returns `null`.
   *
   * @typeParam T - Instance type produced by the constructor
   * @param classConstructor - Class constructor used as the registration key
   * @returns The singleton instance, or `null` if it is not registered
   *
   * @example
   * const db = Container.resolve(Database);
   * if (db) db.connect();
   */
  public static resolve<T>(classConstructor: Constructor<T>): T | null {
    return (this.instances.get(classConstructor) as T) ?? null;
  }
}
