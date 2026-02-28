import { Router, RouterGroup } from "./routing";
import {
  type HttpAdapter,
  HttpMethods,
  NodeHttpAdapter,
  Response,
} from "./http";
import { ValidationException } from "./exceptions/validationException";
import { join } from "node:path";
import type { Middleware, RouteHandler } from "./types";
import { StaticFileHandler } from "./static/fileStaticHandler";
import { createServer } from "node:http";
import { HttpException } from "./exceptions/httpExceptions";
import {
  type TemplateEngineFunction,
  ViewEngine,
} from "./views/engineTemplate";
import { Container } from "./container/container";

/**
 * The `App` class acts as the **execution kernel** and **lifecycle orchestrator**
 * of the framework.
 *
 * It is responsible for:
 * - Bootstrapping and exposing the routing system
 * - Receiving normalized HTTP requests through adapters
 * - Resolving the matching route
 * - Executing the associated controller
 * - Dispatching the final response to the client
 *
 * This class implements the **Singleton pattern** to guarantee
 * a single application instance during the process lifecycle.
 *
 * The architecture fully decouples the core framework
 * from the runtime platform (Node, Bun, Deno, etc.)
 * through {@link HttpAdapter} and {@link Server}.
 */
export class App {
  /** Main routing system */
  private router: Router;

  /** Static file handler (optional) */
  private staticFileHandler: StaticFileHandler | null = null;

  /** View engine for rendering templates (optional) */
  private viewEngine: ViewEngine;

  /**
   * Bootstraps and configures the application.
   *
   * Acts as the **Composition Root** of the framework:
   * this is the only place where concrete infrastructure
   * implementations are instantiated and wired together.
   *
   * @returns The singleton `App` instance
   */
  public static bootstrap(): App {
    const app = Container.singleton(App);
    app.router = Container.singleton(Router);
    app.viewEngine = Container.singleton(ViewEngine);

    return app;
  }

  /**
   * Main execution pipeline.
   *
   * Execution flow:
   * 1. Retrieves the normalized request from the adapter
   * 2. Attempts to serve a static file (if enabled)
   * 3. Resolves the matching route
   * 4. Executes the controller
   * 5. Sends the response back to the client
   *
   * This method is platform-agnostic.
   *
   * @param adapter - HTTP adapter bridging the runtime with the framework
   */
  private async handle(adapter: HttpAdapter): Promise<void> {
    try {
      const request = await adapter.getRequest();

      if (this.staticFileHandler && request.method === HttpMethods.get) {
        const staticResponse = await this.staticFileHandler.tryServeFile(
          request.url,
        );

        if (staticResponse) {
          adapter.sendResponse(staticResponse);
          return;
        }
      }

      const response = await this.router.resolve(request);
      adapter.sendResponse(response);
    } catch (error) {
      this.handleError(error, adapter);
    }
  }

  /**
   * Enables static file serving.
   *
   * @param publicPath - Absolute or relative public directory path
   *
   * @example
   * app.staticFiles("public");
   * app.staticFiles(join(__dirname, "..", "public"));
   * // /public/css/style.css → /css/style.css
   */
  public staticFiles(publicPath: string): void {
    this.staticFileHandler = new StaticFileHandler(publicPath);
  }

  /**
   * Configures the views directory for template rendering.
   *
   * @param pathSegments Path segments leading to the views directory
   * @example
   * app.views(__dirname, "views");
   */
  public views(...pathSegments: string[]): void {
    this.viewEngine.setViewsPath(join(...pathSegments));
  }

  /**
   * Configures the template engine for rendering views.
   *
   * @param extension - File extension associated with the template engine (e.g. "hbs", "ejs")
   * @param engine - Function that renders a template given its path and data
   *
   * @example
   * app.engineTemplates("hbs", (templatePath, data) => {
   *   const content = fs.readFileSync(templatePath, "utf-8");
   *   return content.replace(/{{\s*(\w+)\s*}}/g, (_, key) => {
   *     return data[key] ?? "";
   *   });
   * });
   *
   * // With express-handlebars
   * app.engineTemplates(
   *   "hbs",
   *   engine({
   *     extname: "hbs",
   *     layoutsDir: join(__dirname, "views"),
   *     defaultLayout: "main",
   *   }),
   * );
   *
   * The `extension` parameter allows the framework to automatically select the correct
   * template engine based on the file extension of the view being rendered.
   */
  public engineTemplates(
    extension: string,
    engine: TemplateEngineFunction,
  ): void {
    this.viewEngine.setEngine(extension, engine);
  }

  /**
   * Starts the HTTP server on the given port.
   *
   * @example
   * app.listen(3000);
   *
   * @param port - TCP port to listen on
   */
  public run(
    port: number,
    callback: VoidFunction,
    hostname: string = "127.0.0.1",
  ): void {
    createServer((req, res) => {
      const adapter = new NodeHttpAdapter(req, res);
      void this.handle(adapter);
    }).listen(port, hostname, () => {
      callback();
    });
  }

  /**
   * Sets a global prefix for all routes.
   *
   * @param prefix - Route prefix (e.g. "api", "/v1")
   *
   * @example
   * app.setPrefix("api");
   * app.get("/users", handler); // → /api/users
   */
  public setPrefix(prefix: string): void {
    this.router.setPrefix(prefix);
  }

  /** Registers a GET route */
  public get(
    path: string,
    action: RouteHandler,
    middlewares?: Middleware[],
  ): void {
    this.router.get(path, action, middlewares);
  }

  /** Registers a POST route */
  public post(
    path: string,
    action: RouteHandler,
    middlewares?: Middleware[],
  ): void {
    this.router.post(path, action, middlewares);
  }

  /** Registers a PUT route */
  public put(
    path: string,
    action: RouteHandler,
    middlewares?: Middleware[],
  ): void {
    this.router.put(path, action, middlewares);
  }

  /** Registers a PATCH route */
  public patch(
    path: string,
    action: RouteHandler,
    middlewares?: Middleware[],
  ): void {
    this.router.patch(path, action, middlewares);
  }

  /** Registers a DELETE route */
  public delete(
    path: string,
    action: RouteHandler,
    middlewares?: Middleware[],
  ): void {
    this.router.delete(path, action, middlewares);
  }

  /**
   * Registers global middlewares.
   *
   * These are executed for every route.
   *
   * @example
   * const auth = async (request, next) => {
   *    console.log(request.header);
   *    return await next(request);
   * }
   *
   * app.middlewares(auth);
   */
  public middlewares(middlewares: Middleware[]): void {
    this.router.middlewares(middlewares);
  }

  /**
   * Creates a route group with a shared prefix.
   *
   * @example
   * app.group("/api", (api) => {
   *   api.get("/users", listUsers);
   *   api.post("/users", createUser);
   * });
   */
  public group(prefix: string, callback: (group: RouterGroup) => void): void {
    this.router.group(prefix, callback);
  }

  /**
   * Translates domain-level exceptions into HTTP responses.
   *
   * This method centralizes error handling and response mapping.
   */
  private handleError(error: unknown, adapter: HttpAdapter): void {
    if (error instanceof HttpException) {
      adapter.sendResponse(
        Response.json(error.toJSON()).setStatusCode(error.statusCode),
      );
      return;
    }

    if (error instanceof ValidationException) {
      adapter.sendResponse(
        Response.json({
          errors: error.getErrorsByField(),
        }).setStatusCode(400),
      );
      return;
    }

    adapter.sendResponse(
      Response.json({
        statusCode: 500,
        message: "Internal Server Error",
      }).setStatusCode(500),
    );

    // eslint-disable-next-line no-console
    console.error(error);
  }
}

export const createApp = (): App => {
  return App.bootstrap();
};
