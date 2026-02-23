import { Response } from "../../src/http/response";

describe("ResponseTest", () => {
  it("should json response is constructed correctly", () => {
    const content = { test: "text", num: 1 };
    const response = Response.json(content);

    expect(200).toBe(response.statusCode);
    expect({ "content-type": "application/json" }).toEqual(response.headers);
    expect(JSON.stringify(content)).toEqual(response.content);
  });

  it("should text response is constructed correctly", () => {
    const content = "text";
    const response = Response.text(content);

    expect(200).toBe(response.statusCode);
    expect({ "content-type": "text/plain" }).toEqual(response.headers);
    expect(content).toEqual(response.content);
  });

  it("should redirect response is constructed correctly", () => {
    const url = "redirect/url";
    const response = Response.redirect(url);

    expect(302).toBe(response.statusCode);
    expect({ location: url }).toEqual(response.headers);
    expect(response.content).toBeNull();
  });

  it("should preapre method removes content headers if there is no content", () => {
    const response = new Response();

    response.setContentType("test");
    response.setHeader("content-length", "10");
    response.prepare();

    expect(response.headers).toEqual({
      "content-length": "10",
      "content-type": "test",
    });
  });

  it("should prepare method adds content length header if there is content", () => {
    const content = "text";
    const reponse = Response.text(content);
    reponse.prepare();

    expect(content.length.toString()).toBe(reponse.headers["content-length"]);
  });
});
