import type { SessionStorage } from "./sessionStorage";

/**
 * Representa una sesión activa asociada a una request HTTP.
 *
 * Esta clase actúa como un *facade* sobre una implementación
 * de {@link SessionStorage}, exponiendo una API simple y fluida
 * para interactuar con los datos de sesión.
 *
 * Todas esas responsabilidades pertenecen al `SessionStorage`
 * y al middleware de sesión.
 */
export class Session {
  /**
   * Crea una nueva instancia de `Session`.
   *
   * Esta clase es instanciada internamente por el middleware
   * de sesión y no debería ser creada manualmente por
   * el usuario del framework.
   *
   * @param sessionStorage Implementación concreta de {@link SessionStorage}
   * responsable del manejo interno de la sesión.
   */
  constructor(private sessionStorage: SessionStorage) {
    this.sessionStorage = sessionStorage;
  }

  /**
   * Retorna el identificador único de la sesión actual.
   *
   * @returns El ID de la sesión.
   */
  public id(): string {
    return this.sessionStorage.id();
  }

  /**
   * Obtiene un valor almacenado en la sesión.
   *
   * @param key Clave del valor a obtener.
   * @param defaultValue Valor a retornar si la clave no existe.
   *
   * @returns El valor almacenado o el valor por defecto.
   *
   * @example
   * ```ts
   * const userId = session.get<number>("user_id");
   * ```
   */
  public get<T = unknown>(key: string, defaultValue?: T): T {
    return this.sessionStorage.get(key, defaultValue);
  }

  /**
   * Almacena un valor en la sesión.
   *
   * Este método soporta *method chaining*.
   *
   * @param key Clave bajo la cual se almacenará el valor.
   * @param value Valor a almacenar.
   *
   * @returns La instancia actual de `Session`.
   *
   * @example
   * ```ts
   * session
   *   .set("user_id", 1)
   *   .set("role", "admin");
   * ```
   */
  public set(key: string, value: unknown): this {
    this.sessionStorage.set(key, value);
    return this;
  }

  /**
   * Verifica si una clave existe en la sesión.
   *
   * @param key Clave a verificar.
   *
   * @returns `true` si la clave existe, `false` en caso contrario.
   */
  public has(key: string): boolean {
    return this.sessionStorage.has(key);
  }

  /**
   * Elimina un valor de la sesión.
   *
   * Este método soporta *method chaining*.
   *
   * @param key Clave a eliminar.
   *
   * @returns La instancia actual de `Session`.
   *
   * @example
   * ```ts
   * session.remove("flash_message");
   * ```
   */
  public remove(key: string): this {
    this.sessionStorage.remove(key);
    return this;
  }

  /**
   * Destruye completamente la sesión actual.
   *
   * Elimina todos los datos asociados y
   * la invalida para futuras requests.
   *
   * Este método soporta *method chaining*.
   *
   * @returns La instancia actual de `Session`.
   *
   * @example
   * ```ts
   * session.destroy();
   * ```
   */
  public destroy(): this {
    this.sessionStorage.destroy();
    return this;
  }
}
