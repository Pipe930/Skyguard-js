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
      .setQuery(params)
      .setHeaders(headers)
      .setData(data);

    expect(request.url).toBe(url);
    expect(request.method).toBe(method);
    expect(request.query).toEqual(params);
    expect(request.headers).toEqual(headers);
    expect(request.data).toEqual(data);
  });

  it("should data returns value if key is given", () => {
    const data = {
      test: "hola",
      num: 2,
    };

    const request = new Request("").setData(data);

    expect(request.data).toEqual(data);
  });

  it("should queries returns value if key is given", () => {
    const params = {
      test: "hola",
      num: "2",
    };

    const request = new Request("").setQuery(params);

    expect(params["test"]).toBe(request.query["test"]);
    expect(params["num"]).toBe(request.query["num"]);
    expect(request.query["notexists"]).toBeUndefined();
  });

  it("should queries returns value if key is given", () => {
    const layer = new Layer("/test/{param}/param/{bar}", () =>
      Response.text("holamundo"),
    );
    const request = new Request("/test/2/param/1").setParams(
      layer.parseParameters("/test/2/param/1"),
    );

    expect(request.params["param"]).toBe("2");
    expect(request.params["bar"]).toBe("1");
    expect(request.params["notexists"]).toBeUndefined();
  });
});
