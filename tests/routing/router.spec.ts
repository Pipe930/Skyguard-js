import { Router } from "../../src/routing/router";
import { Response, Request, HttpMethods } from "../../src/http/index";
import { createRequestMock } from "../utils";
import { RouteHandler } from "../../src/types";

describe("RouterTest", () => {
  let router: Router;

  beforeEach(() => {
    jest.clearAllMocks();
    router = new Router();
  });

  it("should resolve basic route with callback action", async () => {
    const url = "/test";
    const action = jest.fn();
    router.get(url, action);

    const requestMock = await createRequestMock(url, HttpMethods.get);
    const routerResolve = router.resolveLayer(requestMock);

    expect(action).toEqual(routerResolve.getAction);
    expect(url).toBe(routerResolve.getUrl);
  });

  it("should resolve multiple basic routees with callback actions", async () => {
    const routes = [
      {
        url: "/posts",
        action: jest.fn(),
      },
      {
        url: "/products",
        action: jest.fn(),
      },
      {
        url: "/users",
        action: jest.fn(),
      },
      {
        url: "/categories",
        action: jest.fn(),
      },
    ];

    routes.forEach((route) => {
      router.get(route.url, route.action);
    });

    for (const route of routes) {
      const requestMock = await createRequestMock(route.url, HttpMethods.get);
      expect(route.action).toEqual(router.resolveLayer(requestMock).getAction);
    }

    for (const route of routes) {
      const requestMock = await createRequestMock(route.url, HttpMethods.get);
      expect(route.url).toBe(router.resolveLayer(requestMock).getUrl);
    }
  });

  it("should throw if route does not exist", async () => {
    const requestMock = await createRequestMock("/not-found", HttpMethods.get);
    expect(() => router.resolveLayer(requestMock)).toThrow("Route not found");
  });

  it("should not mix routes between methods", async () => {
    const url = "/posts";

    const getHandler = jest.fn();
    const postHandler = jest.fn();
    const putHandler = jest.fn();
    const pathHandler = jest.fn();
    const deleteHandler = jest.fn();

    router.get(url, getHandler);
    router.post(url, postHandler);
    router.put(url, putHandler);
    router.patch(url, pathHandler);
    router.delete(url, deleteHandler);

    const requestMockGet = await createRequestMock(url, HttpMethods.get);
    const requestMockPost = await createRequestMock(url, HttpMethods.post);
    const requestMockPut = await createRequestMock(url, HttpMethods.put);
    const requestMockPatch = await createRequestMock(url, HttpMethods.patch);
    const requestMockDelete = await createRequestMock(url, HttpMethods.delete);

    expect(router.resolveLayer(requestMockGet).getAction).toEqual(getHandler);
    expect(router.resolveLayer(requestMockPost).getAction).toEqual(postHandler);
    expect(router.resolveLayer(requestMockPut).getAction).toEqual(putHandler);
    expect(router.resolveLayer(requestMockPatch).getAction).toEqual(
      pathHandler,
    );
    expect(router.resolveLayer(requestMockDelete).getAction).toEqual(
      deleteHandler,
    );
  });

  it("should valid run middlewares", async () => {
    const middleware1 = async (
      request: Request,
      next: RouteHandler,
    ): Promise<Response> => {
      const response = await next(request);
      response.setHeader("x-test-one", "one");
      return response;
    };

    const middleware2 = async (
      request: Request,
      next: RouteHandler,
    ): Promise<Response> => {
      const response = await next(request);
      response.setHeader("x-test-two", "two");
      return response;
    };

    const responseExcepted = Response.text("hola");
    const url = "/test/hola";

    router.get(url, () => responseExcepted, [middleware1, middleware2]);

    const requestMock = await createRequestMock(url, HttpMethods.get);
    const response = await router.resolve(requestMock);

    expect(responseExcepted).toBe(response);
    expect(response.getHeaders["x-test-one"]).toBe("one");
    expect(response.getHeaders["x-test-two"]).toBe("two");
  });

  it("should middleware stack can be stopped", async () => {
    const middlewareStopped = (): Response => {
      return Response.text("stopped");
    };

    const middleware2 = async (
      request: Request,
      next: RouteHandler,
    ): Promise<Response> => {
      const response = await next(request);
      response.setHeader("x-test-two", "two");
      return response;
    };

    const responseExcepted = Response.text("Unreachable");
    const url = "/test/hola";

    router.get(url, () => responseExcepted, [middlewareStopped, middleware2]);

    const requestMock = await createRequestMock(url, HttpMethods.get);
    const response = await router.resolve(requestMock);

    expect("stopped").toBe(response.getContent);
    expect(response.getHeaders["x-test-two"]).toBeUndefined();
  });
});
