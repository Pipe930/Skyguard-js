import { Layer } from "../../src/routing/layer";

describe("LayerTest", () => {
  let layer: Layer;

  const listUrlsNoParameters: string[] = [
    "/",
    "/test",
    "/test/nested",
    "/test/another/nested/very/nested/route",
  ];

  const listUrlsWithParameters: string[] = [
    "/user/{id}",
    "/product/{category}/{id}",
    "/order/{orderId}/item/{itemId}",
    "/blog/{year}/{month}/{day}/{slug}",
  ];

  beforeEach(() => {
    layer = new Layer(listUrlsNoParameters[1], jest.fn());
  });

  it("should regex with no parameters", () => {
    expect(layer.matches(listUrlsNoParameters[1])).toBe(true);
    expect(layer.matches(listUrlsNoParameters[2])).toBe(false);
    expect(layer.matches(listUrlsNoParameters[3])).toBe(false);
  });

  it("should regex on url that ends with slash", () => {
    expect(layer.matches(listUrlsNoParameters[1] + "/")).toBe(true);
  });

  it("should regex with parameters", () => {
    const layerWithParams = new Layer(listUrlsWithParameters[1], jest.fn());

    expect(layerWithParams.matches("/product/electronics/123")).toBe(true);
    expect(layerWithParams.matches("/product/books/456")).toBe(true);
    expect(layerWithParams.matches("/product/electronics")).toBe(false);
    expect(layerWithParams.matches("/product/electronics/123/extra")).toBe(
      false,
    );
  });

  it("should parse parameters correctly", () => {
    const layerWithParams = new Layer(listUrlsWithParameters[1], jest.fn());

    const params = layerWithParams.parseParameters("/product/electronics/123");
    expect(params).toEqual({ category: "electronics", id: "123" });

    const params2 = layerWithParams.parseParameters("/product/books/456");
    expect(params2).toEqual({ category: "books", id: "456" });
  });
});
