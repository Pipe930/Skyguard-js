jest.mock("../../src/routing/buildFullPath", () => ({
  buildFullPath: jest.fn(),
}));
import { RouteHandler } from "../../src/types";
import { Layer, Router, RouterGroup } from "../../src/routing/index";
import { buildFullPath } from "../../src/routing/buildFullPath";

const testMiddlewareA = jest.fn();
const testMiddlewareB = jest.fn();
const handler: RouteHandler = jest.fn();

function createLayerMock() {
  return {
    setMiddlewares: jest.fn(),
  } as unknown as Layer;
}

function createRouterMock(): Router {
  return {
    get: jest.fn(() => createLayerMock()),
    post: jest.fn(() => createLayerMock()),
    put: jest.fn(() => createLayerMock()),
    patch: jest.fn(() => createLayerMock()),
    delete: jest.fn(() => createLayerMock()),
  } as unknown as Router;
}

describe("RouterGroup", () => {
  let router: Router;
  let group: RouterGroup;

  beforeEach(() => {
    router = createRouterMock();
    group = new RouterGroup("/api", router);
  });

  it("registra una ruta GET con el prefijo correcto", () => {
    const router = createRouterMock();
    const group = new RouterGroup("/api", router);

    (buildFullPath as jest.Mock).mockReturnValue("/api/users");

    group.get("/users", handler);

    expect(buildFullPath).toHaveBeenCalledWith("/users", "/api");
    expect(router.get).toHaveBeenCalledWith("/api/users", handler);
  });

  it("normaliza slashes duplicados", () => {
    const g = new RouterGroup("api/", router);

    (buildFullPath as jest.Mock).mockReturnValue("/api/users");

    g.get("/users/", handler);

    expect(buildFullPath).toHaveBeenCalledWith("/users/", "api/");
    expect(router.get).toHaveBeenCalledWith("/api/users", handler);
  });

  it("aplica middlewares de grupo a la ruta", () => {
    const layer = createLayerMock();
    (router.get as jest.Mock).mockReturnValue(layer);

    group.middlewares([testMiddlewareA]);
    group.get("/users", handler);

    expect(layer.setMiddlewares).toHaveBeenCalledWith([testMiddlewareA]);
  });

  it("combina middlewares de grupo y de ruta", () => {
    const layer = createLayerMock();
    (router.get as jest.Mock).mockReturnValue(layer);

    group.middlewares([testMiddlewareA]);
    group.get("/users", handler, [testMiddlewareB]);

    expect(layer.setMiddlewares).toHaveBeenCalledWith([
      testMiddlewareA,
      testMiddlewareB,
    ]);
  });

  it("no llama setMiddlewares si no hay middlewares", () => {
    const layer = createLayerMock();
    (router.get as jest.Mock).mockReturnValue(layer);

    group.get("/users", handler);

    expect(layer.setMiddlewares).not.toHaveBeenCalled();
  });

  it("usa el método POST correctamente", () => {
    (buildFullPath as jest.Mock).mockReturnValue("/api/users");

    group.post("/users", handler);

    expect(buildFullPath).toHaveBeenCalledWith("/users", "/api");
    expect(router.post).toHaveBeenCalledWith("/api/users", handler);
  });

  it("usa el método PUT correctamente", () => {
    (buildFullPath as jest.Mock).mockReturnValue("/api/users/1");

    group.put("/users/1", handler);

    expect(buildFullPath).toHaveBeenCalledWith("/users/1", "/api");
    expect(router.put).toHaveBeenCalledWith("/api/users/1", handler);
  });

  it("usa el método PATCH correctamente", () => {
    (buildFullPath as jest.Mock).mockReturnValue("/api/users/1");

    group.patch("/users/1", handler);

    expect(buildFullPath).toHaveBeenCalledWith("/users/1", "/api");
    expect(router.patch).toHaveBeenCalledWith("/api/users/1", handler);
  });

  it("usa el método DELETE correctamente", () => {
    (buildFullPath as jest.Mock).mockReturnValue("/api/users/1");

    group.delete("/users/1", handler);

    expect(buildFullPath).toHaveBeenCalledWith("/users/1", "/api");
    expect(router.delete).toHaveBeenCalledWith("/api/users/1", handler);
  });

  it("permite encadenar middlewares()", () => {
    const result = group.middlewares([testMiddlewareA]);

    expect(result).toBe(group);
  });
});
