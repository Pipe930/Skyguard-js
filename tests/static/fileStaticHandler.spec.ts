import { stat, readFile } from "node:fs/promises";
import { normalize } from "node:path";
import { StaticFileHandler } from "../../src/static/fileStaticHandler";

jest.mock("fs/promises", () => ({
  stat: jest.fn(),
  readFile: jest.fn(),
}));

jest.mock("../../src/http", () => ({
  Response: jest.fn().mockImplementation(() => ({
    setContent: jest.fn().mockReturnThis(),
    setHeaders: jest.fn().mockReturnThis(),
    setStatus: jest.fn().mockReturnThis(),
  })),
}));

jest.mock("../../src/static/mimeTypes", () => ({
  mimeTypesObject: {
    ".css": "text/css",
    ".js": "application/javascript",
    default: "application/octet-stream",
  },
}));

const mockStat = (overrides: Partial<any> = {}) => ({
  isFile: () => true,
  size: 100,
  mtime: new Date("2024-01-01"),
  ...overrides,
});

describe("StaticFileHandlerTest", () => {
  const publicPath = normalize("/var/www/public");
  let handler: StaticFileHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new StaticFileHandler(publicPath);
  });

  it("should return the correct url prefix", () => {
    expect(handler.getUrlPrefix()).toBe("/public");
  });

  it("should match paths and not match paths that start with the url prefix", () => {
    expect(handler.matchesPrefix("/public/style.css")).toBe(true);
    expect(handler.matchesPrefix("/assets/style.css")).toBe(false);
  });

  it("should identify valid static file requests", () => {
    expect(handler.isStaticFileRequest("/public/app.css")).toBe(true);
    expect(handler.isStaticFileRequest("/assets/app.css")).toBe(false);
    expect(handler.isStaticFileRequest("/public/assets")).toBe(false);
    expect(handler.isStaticFileRequest("/public/file.unknown")).toBe(false);
  });

  it("should serve an existing static file", async () => {
    (stat as jest.Mock).mockResolvedValue(mockStat());
    (readFile as jest.Mock).mockResolvedValue(Buffer.from("body"));

    const response = await handler.tryServeFile("/public/app.css");

    expect(response).not.toBeNull();
    expect(stat).toHaveBeenCalled();
    expect(readFile).toHaveBeenCalled();
  });

  it("should return null when the request does not match the prefix", async () => {
    const response = await handler.tryServeFile("/assets/app.css");
    expect(response).toBeNull();
  });

  it("should prevent path traversal attacks", async () => {
    const response = await handler.tryServeFile("/public/../../secret.txt");
    expect(response).toBeNull();
  });

  it("should return null when the file does not exist", async () => {
    (stat as jest.Mock).mockRejectedValue(new Error("ENOENT"));

    const response = await handler.tryServeFile("/public/missing.css");
    expect(response).toBeNull();
  });

  it("should return null when the path is not a file", async () => {
    (stat as jest.Mock).mockResolvedValue(mockStat({ isFile: () => false }));

    const response = await handler.tryServeFile("/public/folder");
    expect(response).toBeNull();
  });

  it("should use the default content type when the extension is unknown", async () => {
    (stat as jest.Mock).mockResolvedValue(mockStat());
    (readFile as jest.Mock).mockResolvedValue(Buffer.from("data"));

    const response = await handler.tryServeFile("/public/file.unknown");

    expect(response).not.toBeNull();
  });
});
