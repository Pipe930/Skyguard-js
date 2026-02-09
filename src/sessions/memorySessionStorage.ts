import { SessionException } from "../exceptions";
import type { SessionData, SessionStorage } from "./sessionStorage";
import { randomBytes } from "node:crypto";

/**
 * Implementación de {@link SessionStorage} basada en memoria.
 *
 * Este storage mantiene todas las sesiones en un `Map` estático
 * compartido a nivel de proceso Node.js.
 *
 * ⚠️ IMPORTANTE:
 * - Las sesiones **se pierden al reiniciar el proceso**
 * - No es seguro para entornos con múltiples instancias
 * - Recomendado solo para desarrollo, testing o prototipos
 *
 * El ciclo de vida de la sesión es:
 * 1. `start()` → crea una nueva sesión
 * 2. `load(id)` → carga una sesión existente
 * 3. Acceso y mutación de datos
 * 4. `destroy()` → elimina la sesión
 */
export class MemorySessionStorage implements SessionStorage {
  /**
   * Almacenamiento global de sesiones en memoria.
   *
   * La clave es el sessionId y el valor contiene los datos
   * y la fecha de expiración.
   */
  private static storageSessions = new Map<string, SessionData>();

  /** ID de la sesión actualmente cargada */
  private sessionId: string | null = null;

  /** Datos asociados a la sesión */
  private data: Record<string, unknown> = {};

  /** Validación estricta del formato del sessionId */
  private regexSessionId = /^[a-f0-9]{64}$/;

  /**
   * Crea una nueva instancia de `MemorySessionStorage`.
   *
   * @param expiredSession Tiempo de expiración en milisegundos.
   */
  constructor(private readonly expiredSession: number) {}

  /**
   * Carga una sesión existente a partir de su ID.
   *
   * - Valida el formato del ID
   * - Verifica existencia
   * - Verifica expiración
   * - Renueva la expiración si es válida
   *
   * @param id Identificador de la sesión.
   *
   * @throws SessionException Si el ID es inválido, no existe
   * o la sesión está expirada.
   */
  public load(id: string): void {
    if (!this.regexSessionId.test(id))
      throw new SessionException("Invalid Session");

    const sessionData = MemorySessionStorage.storageSessions.get(id);

    if (!sessionData) throw new SessionException("Invalid Session");

    if (sessionData.expiresAt > Date.now()) {
      this.sessionId = id;
      this.data = sessionData.data;
      sessionData.expiresAt = this.createExpiredSession();
    }
  }

  /**
   * Calcula la nueva fecha de expiración de la sesión.
   *
   * @returns Timestamp de expiración.
   */
  private createExpiredSession(): number {
    return Date.now() + this.expiredSession;
  }

  /**
   * Inicia una nueva sesión si no existe una activa.
   *
   * - Genera un nuevo sessionId
   * - Inicializa el almacenamiento
   * - Registra la sesión en memoria
   */
  public start(): void {
    if (this.sessionId) return;

    this.sessionId = this.generateId();
    this.data = {};

    MemorySessionStorage.storageSessions.set(this.sessionId, {
      data: this.data,
      expiresAt: this.createExpiredSession(),
    });
  }

  /**
   * Retorna el ID de la sesión actual.
   *
   * @returns Session ID o `null` si no hay sesión iniciada.
   */
  public id(): string | null {
    return this.sessionId;
  }

  /**
   * Obtiene un valor almacenado en la sesión.
   *
   * @param key Clave del valor.
   * @param defaultValue Valor por defecto.
   *
   * @returns El valor almacenado o el valor por defecto.
   */
  public get<T>(key: string, defaultValue?: T): T | undefined {
    return (this.data[key] as T) ?? defaultValue;
  }

  /**
   * Almacena un valor en la sesión.
   *
   * Si la sesión no existe, se inicia automáticamente.
   *
   * @param key Clave del valor.
   * @param value Valor a almacenar.
   */
  public set<T>(key: string, value: T): void {
    if (!this.sessionId) this.start();
    this.data[key] = value;
  }

  /**
   * Verifica si una clave existe en la sesión.
   *
   * @param key Clave a verificar.
   *
   * @returns `true` si existe, `false` en caso contrario.
   */
  public has(key: string): boolean {
    return key in this.data;
  }

  /**
   * Elimina una clave de la sesión.
   *
   * Si no hay sesión activa, no hace nada.
   *
   * @param key Clave a eliminar.
   */
  public remove(key: string): void {
    if (!this.sessionId) return;
    delete this.data[key];
  }

  /**
   * Destruye completamente la sesión actual.
   *
   * - Elimina la sesión del almacenamiento global
   * - Limpia el estado interno
   */
  public destroy(): void {
    if (this.sessionId)
      MemorySessionStorage.storageSessions.delete(this.sessionId);

    this.sessionId = null;
    this.data = {};
  }

  /**
   * Elimina todas las sesiones expiradas del almacenamiento.
   *
   * Este método debe ser ejecutado periódicamente
   * (por ejemplo, mediante un cron o intervalo).
   */
  public static cleanExpiredSessions(): void {
    const now = Date.now();

    for (const [id, session] of MemorySessionStorage.storageSessions) {
      if (session.expiresAt < now)
        MemorySessionStorage.storageSessions.delete(id);
    }
  }

  /**
   * Genera un identificador de sesión criptográficamente seguro.
   *
   * @returns Session ID en formato hexadecimal (64 caracteres).
   */
  private generateId(): string {
    return randomBytes(32).toString("hex");
  }
}
