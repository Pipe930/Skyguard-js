import { BadRequestError } from "../../src/exceptions/httpExceptions";
import { FileDownloadHelper } from "../../src/static/fileDownload";
import { stat, readFile } from "node:fs/promises";
import { resolve, extname, basename } from "node:path";

jest.mock("node:fs/promises");
jest.mock("node:path");

describe("FileDownloadHelper", () => {
  let fileDownloadHelper: FileDownloadHelper;

  beforeEach(() => {
    fileDownloadHelper = new FileDownloadHelper();
    jest.clearAllMocks();
  });

  it("should download file successfully with default filename", async () => {
    const mockContent = Buffer.from("test content");
    const mockFilePath = "/path/to/test.txt";

    jest.mocked(resolve).mockReturnValue(mockFilePath);
    jest.mocked(basename).mockReturnValue("test.txt");
    jest.mocked(extname).mockReturnValue(".txt");
    jest.mocked(stat).mockResolvedValue({ isFile: () => true } as any);
    jest.mocked(readFile).mockResolvedValue(mockContent);

    const response = await fileDownloadHelper.download(mockFilePath);

    expect(response.content).toBe(mockContent);
    expect(response.downloadHeaders["Content-Length"]).toBe(
      mockContent.length.toString(),
    );
    expect(response.downloadHeaders["Content-Disposition"]).toContain(
      "test.txt",
    );
  });

  it("should download file with custom filename", async () => {
    const mockContent = Buffer.from("test content");
    const customFilename = "custom-name.pdf";

    jest.mocked(resolve).mockReturnValue("/path/to/file.pdf");
    jest.mocked(extname).mockReturnValue(".pdf");
    jest.mocked(stat).mockResolvedValue({ isFile: () => true } as any);
    jest.mocked(readFile).mockResolvedValue(mockContent);

    const response = await fileDownloadHelper.download(
      "/path/to/file.pdf",
      customFilename,
    );

    expect(response.downloadHeaders["Content-Disposition"]).toContain(
      customFilename,
    );
  });

  it("should include custom headers in response", async () => {
    const mockContent = Buffer.from("test");
    const customHeaders = {
      "X-Custom-Header": "custom-value",
      "Cache-Control": "no-cache",
    };

    jest.mocked(resolve).mockReturnValue("/test.txt");
    jest.mocked(basename).mockReturnValue("test.txt");
    jest.mocked(extname).mockReturnValue(".txt");
    jest.mocked(stat).mockResolvedValue({ isFile: () => true } as any);
    jest.mocked(readFile).mockResolvedValue(mockContent);

    const response = await fileDownloadHelper.download(
      "/test.txt",
      undefined,
      customHeaders,
    );

    expect(response.downloadHeaders["X-Custom-Header"]).toBe("custom-value");
    expect(response.downloadHeaders["Cache-Control"]).toBe("no-cache");
  });

  it("should not override Content-Disposition with custom headers", async () => {
    const mockContent = Buffer.from("test");
    const customHeaders = { "content-disposition": "inline" };

    jest.mocked(resolve).mockReturnValue("/test.txt");
    jest.mocked(basename).mockReturnValue("test.txt");
    jest.mocked(extname).mockReturnValue(".txt");
    jest.mocked(stat).mockResolvedValue({ isFile: () => true } as any);
    jest.mocked(readFile).mockResolvedValue(mockContent);

    const response = await fileDownloadHelper.download(
      "/test.txt",
      undefined,
      customHeaders,
    );

    expect(response.downloadHeaders["Content-Disposition"]).toContain(
      "attachment",
    );
  });

  it("should throw exception when path is not a file", async () => {
    jest.mocked(resolve).mockReturnValue("/path/to/directory");
    jest.mocked(stat).mockResolvedValue({ isFile: () => false } as any);

    await expect(
      fileDownloadHelper.download("/path/to/directory"),
    ).rejects.toThrow(BadRequestError);
  });

  it("should throw exception when file cannot be read", async () => {
    jest.mocked(resolve).mockReturnValue("/test.txt");
    jest.mocked(stat).mockRejectedValue(new Error("File not found"));

    await expect(fileDownloadHelper.download("/test.txt")).rejects.toThrow(
      "Failed to download file",
    );
  });

  it("should set correct MIME type for known extensions", async () => {
    const mockContent = Buffer.from("pdf content");

    jest.mocked(resolve).mockReturnValue("/test.pdf");
    jest.mocked(basename).mockReturnValue("test.pdf");
    jest.mocked(extname).mockReturnValue(".pdf");
    jest.mocked(stat).mockResolvedValue({ isFile: () => true } as any);
    jest.mocked(readFile).mockResolvedValue(mockContent);

    const response = await fileDownloadHelper.download("/test.pdf");

    expect(response.downloadHeaders["Content-Type"]).toBe("application/pdf");
  });

  it("should default to octet-stream for unknown extensions", async () => {
    const mockContent = Buffer.from("unknown content");

    jest.mocked(resolve).mockReturnValue("/test.xyz");
    jest.mocked(basename).mockReturnValue("test.xyz");
    jest.mocked(extname).mockReturnValue(".xyz");
    jest.mocked(stat).mockResolvedValue({ isFile: () => true } as any);
    jest.mocked(readFile).mockResolvedValue(mockContent);

    const response = await fileDownloadHelper.download("/test.xyz");

    expect(response.downloadHeaders["Content-Type"]).toBe(
      "application/octet-stream",
    );
  });
});
