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

  it("should register a GET route with the correct prefix", () => {
    const router = createRouterMock();
    const group = new RouterGroup("/api", router);

    (buildFullPath as jest.Mock).mockReturnValue("/api/users");

    group.get("/users", handler);

    expect(buildFullPath).toHaveBeenCalledWith("/users", "/api");
    expect(router.get).toHaveBeenCalledWith("/api/users", handler);
  });

  it("should normalize duplicate slashes", () => {
    const g = new RouterGroup("api/", router);

    (buildFullPath as jest.Mock).mockReturnValue("/api/users");

    g.get("/users/", handler);

    expect(buildFullPath).toHaveBeenCalledWith("/users/", "api/");
    expect(router.get).toHaveBeenCalledWith("/api/users", handler);
  });

  it("should apply group middlewares to the route", () => {
    const layer = createLayerMock();
    (router.get as jest.Mock).mockReturnValue(layer);

    group.middlewares([testMiddlewareA]);
    group.get("/users", handler);

    expect(layer.setMiddlewares).toHaveBeenCalledWith([testMiddlewareA]);
  });

  it("should combine group and route middlewares", () => {
    const layer = createLayerMock();
    (router.get as jest.Mock).mockReturnValue(layer);

    group.middlewares([testMiddlewareA]);
    group.get("/users", handler, [testMiddlewareB]);

    expect(layer.setMiddlewares).toHaveBeenCalledWith([
      testMiddlewareA,
      testMiddlewareB,
    ]);
  });

  it("should not call setMiddlewares if no middlewares are provided", () => {
    const layer = createLayerMock();
    (router.get as jest.Mock).mockReturnValue(layer);

    group.get("/users", handler);

    expect(layer.setMiddlewares).not.toHaveBeenCalled();
  });

  it("should use POST method correctly", () => {
    (buildFullPath as jest.Mock).mockReturnValue("/api/users");

    group.post("/users", handler);

    expect(buildFullPath).toHaveBeenCalledWith("/users", "/api");
    expect(router.post).toHaveBeenCalledWith("/api/users", handler);
  });

  it("should use PUT method correctly", () => {
    (buildFullPath as jest.Mock).mockReturnValue("/api/users/1");

    group.put("/users/1", handler);

    expect(buildFullPath).toHaveBeenCalledWith("/users/1", "/api");
    expect(router.put).toHaveBeenCalledWith("/api/users/1", handler);
  });

  it("should use PATCH method correctly", () => {
    (buildFullPath as jest.Mock).mockReturnValue("/api/users/1");

    group.patch("/users/1", handler);

    expect(buildFullPath).toHaveBeenCalledWith("/users/1", "/api");
    expect(router.patch).toHaveBeenCalledWith("/api/users/1", handler);
  });

  it("should use DELETE method correctly", () => {
    (buildFullPath as jest.Mock).mockReturnValue("/api/users/1");

    group.delete("/users/1", handler);

    expect(buildFullPath).toHaveBeenCalledWith("/users/1", "/api");
    expect(router.delete).toHaveBeenCalledWith("/api/users/1", handler);
  });

  it("should allow chaining middlewares()", () => {
    const result = group.middlewares([testMiddlewareA]);

    expect(result).toBe(group);
  });
});
