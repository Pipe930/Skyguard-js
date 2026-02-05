import { RouteHandler } from "../../src/types";
import { Middleware } from "../../src/http";
import { Layer, Router, RouterGroup } from "../../src/routing";

class TestMiddlewareA implements Middleware {
  handle = jest.fn();
}

class TestMiddlewareB implements Middleware {
  handle = jest.fn();
}

/* ----------------- Dummy Handler ----------------- */

const handler: RouteHandler = jest.fn();

/* ----------------- Layer Mock ----------------- */

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
    group.get("/users", handler);

    expect(router.get).toHaveBeenCalledWith("/api/users", handler);
  });

  it("normaliza slashes duplicados", () => {
    const g = new RouterGroup("api/", router);

    g.get("/users/", handler);

    expect(router.get).toHaveBeenCalledWith("/api/users", handler);
  });

  it("aplica middlewares de grupo a la ruta", () => {
    const layer = createLayerMock();
    (router.get as jest.Mock).mockReturnValue(layer);

    group.middlewares([TestMiddlewareA]);
    group.get("/users", handler);

    expect(layer.setMiddlewares).toHaveBeenCalledWith([TestMiddlewareA]);
  });

  it("combina middlewares de grupo y de ruta", () => {
    const layer = createLayerMock();
    (router.get as jest.Mock).mockReturnValue(layer);

    group.middlewares([TestMiddlewareA]);
    group.get("/users", handler, [TestMiddlewareB]);

    expect(layer.setMiddlewares).toHaveBeenCalledWith([
      TestMiddlewareA,
      TestMiddlewareB,
    ]);
  });

  it("no llama setMiddlewares si no hay middlewares", () => {
    const layer = createLayerMock();
    (router.get as jest.Mock).mockReturnValue(layer);

    group.get("/users", handler);

    expect(layer.setMiddlewares).not.toHaveBeenCalled();
  });

  it("usa el método POST correctamente", () => {
    group.post("/users", handler);

    expect(router.post).toHaveBeenCalledWith("/api/users", handler);
  });

  it("usa el método PUT correctamente", () => {
    group.put("/users/1", handler);

    expect(router.put).toHaveBeenCalledWith("/api/users/1", handler);
  });

  it("usa el método PATCH correctamente", () => {
    group.patch("/users/1", handler);

    expect(router.patch).toHaveBeenCalledWith("/api/users/1", handler);
  });

  it("usa el método DELETE correctamente", () => {
    group.delete("/users/1", handler);

    expect(router.delete).toHaveBeenCalledWith("/api/users/1", handler);
  });

  it("permite encadenar middlewares()", () => {
    const result = group.middlewares([TestMiddlewareA]);

    expect(result).toBe(group);
  });
});
