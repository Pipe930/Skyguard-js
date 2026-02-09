import { Request, Response, HttpMethods } from "../../src/http/index";
import { Layer } from "../../src/routing/layer";

describe("RequestTest", () => {
  it("should request returns data obtained from server correctly", () => {
    const url = "/test/route";
    const method = HttpMethods.post;
    const params = { id: "1" };
    const headers = { "content-type": "application/json" };
    const data = { search: "gemini" };

    const request = new Request(url)
      .setMethod(method)
      .setQueryParams(params)
      .setHeaders(headers)
      .setData(data);

    expect(url).toBe(request.getUrl);
    expect(method).toBe(request.getMethod);
    expect(params).toEqual(request.getQueryParams());
    expect(headers).toEqual(request.getHeaders);
    expect(data).toEqual(request.getData());
  });

  it("should data returns value if key is given", () => {
    const data = {
      test: "hola",
      num: 2,
    };

    const request = new Request("").setData(data);

    expect(data).toBe(request.getData());
  });

  it("should queries returns value if key is given", () => {
    const params = {
      test: "hola",
      num: "2",
    };

    const request = new Request("").setQueryParams(params);

    expect(params["test"]).toBe(request.getQueryParams("test"));
    expect(params["num"]).toBe(request.getQueryParams("num"));
    expect(request.getQueryParams("notexists")).toBeNull();
  });

  it("should queries returns value if key is given", () => {
    const layer = new Layer("/test/{param}/param/{bar}", () =>
      Response.text("holamundo"),
    );
    const request = new Request("/test/2/param/1").setLayer(layer);

    expect(request.getParams("param")).toBe("2");
    expect(request.getParams("bar")).toBe("1");
    expect(request.getParams("notexists")).toBeNull();
  });
});
