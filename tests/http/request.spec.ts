import { Request, Response, HttpMethods } from "../../src/http";
import { Layer } from "../../src/routing";

describe("RequestTest", () => {
  it("should request returns data obtained from server correctly", () => {
    const url = "/test/route";
    const method = HttpMethods.post;
    const params = { id: 1 };
    const headers = { "content-type": "application/json" };
    const data = { search: "gemini" };

    const request = new Request()
      .setUrl(url)
      .setMethod(method)
      .setQueryParameters(params)
      .setHeaders(headers)
      .setData(data);

    expect(url).toBe(request.getUrl);
    expect(method).toBe(request.getMethod);
    expect(params).toEqual(request.getParams());
    expect(headers).toEqual(request.getHeaders);
    expect(data).toEqual(request.getData());
  });

  it("should data returns value if key is given", () => {
    const data = {
      test: "hola",
      num: 2,
    };

    const request = new Request().setData(data);

    expect(data["test"]).toBe(request.getData("test"));
    expect(data["num"]).toBe(request.getData("num"));
    expect(request.getData("notexists")).toBeNull();
  });

  it("should queries returns value if key is given", () => {
    const query = {
      test: "hola",
      num: 2,
    };

    const request = new Request().setQueryParameters(query);

    expect(query["test"]).toBe(request.getParams("test"));
    expect(query["num"]).toBe(request.getParams("num"));
    expect(request.getParams("notexists")).toBeNull();
  });

  it("should queries returns value if key is given", () => {
    const layer = new Layer("/test/{param}/param/{bar}", () =>
      Response.text("holamundo"),
    );
    const request = new Request().setLayer(layer).setUrl("/test/2/param/1");

    expect(request.getlayerParameters("param")).toBe("2");
    expect(request.getlayerParameters("bar")).toBe("1");
    expect(request.getlayerParameters("notexists")).toBeNull();
  });
});
