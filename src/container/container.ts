import { Constructor } from "../utils/types";

/**
 * Contenedor de Inyección de Dependencias.
 *
 * Gestiona instancias singleton de clases, asegurando que solo
 * exista una instancia de cada clase registrada en toda la aplicación.
 *
 * @example
 * // Registrar y obtener un singleton
 * const app = Container.singleton(App);
 *
 * // Resolver una instancia existente
 * const resolvedApp = Container.resolve(App);
 */
export class Container {
  /**
   * Almacena las instancias singleton indexadas por el constructor de la clase.
   */
  private static instances = new Map<Constructor, any>();

  /**
   * Obtiene o crea una instancia singleton de la clase especificada.
   *
   * Si la instancia ya existe, la devuelve.
   * Si no existe, crea una nueva instancia, la almacena y la devuelve.
   *
   * @template T - Tipo de la clase a instanciar
   * @param classConstructor - Constructor de la clase
   * @returns Devuelve una instancia singleton de la clase
   *
   * @example
   * class Database {
   *   connect() { console.log('Connected'); }
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
   * Resuelve una instancia singleton previamente registrada.
   *
   * @template T - Tipo de la clase a resolver
   * @param classConstructor - Constructor de la clase
   * @returns Devuelve una instancia si existe o null si no está registrada
   *
   * @example
   * const db = Container.resolve(Database);
   * if (db) {
   *   db.connect();
   * }
   */
  public static resolve<T>(classConstructor: Constructor<T>): T | null {
    return (this.instances.get(classConstructor) as T) ?? null;
  }
}
