/**
 * Contrato para un almacenamiento de sesión síncrono.
 *
 * Define las operaciones básicas para manejar una sesión
 * durante el ciclo de vida de una request HTTP.
 *
 * Las implementaciones de esta interfaz son responsables de:
 * - Crear sesiones
 * - Cargar sesiones existentes
 * - Almacenar y recuperar datos
 * - Controlar la expiración y destrucción de la sesión
 *
 * Esta interfaz está pensada para drivers síncronos
 * (por ejemplo, almacenamiento en memoria).
 */
export interface SessionStorage {
  /**
   * Carga una sesión existente a partir de su identificador.
   *
   * Si la sesión no existe o es inválida, la implementación
   * debe lanzar una excepción o ignorar la carga según
   * su política interna.
   *
   * @param id Identificador único de la sesión.
   */
  load(id: string): void;

  /**
   * Inicia una nueva sesión.
   *
   * Si la sesión ya fue iniciada previamente, la implementación
   * debe evitar recrearla.
   */
  start(): void;

  /**
   * Retorna el identificador de la sesión actual.
   *
   * @returns El ID de la sesión activa.
   */
  id(): string;

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
  get<T = unknown>(key: string, defaultValue?: T): T;

  /**
   * Almacena un valor en la sesión.
   *
   * Si la sesión aún no ha sido iniciada, la implementación
   * debe iniciarla automáticamente.
   *
   * @param key Clave bajo la cual se almacenará el valor.
   * @param value Valor a almacenar.
   *
   * @example
   * ```ts
   * session.set("user_id", 1);
   * ```
   */
  set(key: string, value: unknown): void;

  /**
   * Verifica si una clave existe en la sesión.
   *
   * @param key Clave a verificar.
   *
   * @returns `true` si la clave existe, `false` en caso contrario.
   */
  has(key: string): boolean;

  /**
   * Elimina un valor de la sesión.
   *
   * @param key Clave a eliminar.
   */
  remove(key: string): void;

  /**
   * Destruye completamente la sesión.
   *
   * Elimina todos los datos asociados y
   * la invalida para futuras requests.
   */
  destroy(): void;
}

/**
 * Representa los datos internos de una sesión persistida.
 *
 * Esta estructura es utilizada por los `SessionStorage`
 * para almacenar el estado de la sesión en el servidor.
 *
 * No debe ser expuesta directamente al usuario del framework.
 */
export interface SessionData {
  /**
   * Datos almacenados en la sesión.
   *
   * Las claves y valores son definidos por la aplicación.
   */
  data: Record<string, unknown>;

  /**
   * Timestamp (en milisegundos) que indica
   * cuándo la sesión expira.
   */
  expiresAt: number;
}

/**
 * Contrato para un almacenamiento de sesión asíncrono SessionStorage.
 *
 * Define las mismas operaciones que {@link SessionStorage},
 * pero orientadas a drivers asíncronos como:
 * - Filesystem
 * - Base de datos
 * - Redis
 *
 * Todas las operaciones retornan Promises.
 */
export interface AsyncSessionStorage {
  start(): Promise<void>;
  id(): string;
  get<T = unknown>(key: string, defaultValue?: T): Promise<T>;
  set(key: string, value: unknown): Promise<void>;
  has(key: string): Promise<boolean>;
  remove(key: string): Promise<void>;
  destroy(): Promise<void>;
}
