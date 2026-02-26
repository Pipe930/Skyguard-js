import { createUploader } from "../../src/storage/uploader";
import { StorageType, UploadErrorCode } from "../../src/storage/types";
import { Request } from "../../src/http/request";

describe("Uploader", () => {
  const makeFile = (fieldName: string, filename: string, content = "ok") => ({
    fieldName,
    filename,
    mimetype: "text/plain",
    size: Buffer.byteLength(content),
    data: Buffer.from(content),
  });

  const next = jest.fn();

  it("single() stores a single file and merges fields", async () => {
    const uploader = createUploader({
      storageType: StorageType.MEMORY,
      storageOptions: { memory: {} },
    });

    const request = new Request("/test");
    request.setHeaders({ "content-type": "multipart/form-data" });
    request.setData({
      fields: { name: "juan" },
      files: [makeFile("avatar", "a.txt", "hello")],
    });

    const mw = uploader.single("avatar");

    await mw(request, next);

    expect(request.file).toBeDefined();
    expect(request.file.originalname).toBe("a.txt");
    expect(request.data.name).toBe("juan");
  });

  it("single() passes through when no multipart payload", async () => {
    const uploader = createUploader({
      storageType: StorageType.MEMORY,
      storageOptions: { memory: {} },
    });

    const request = new Request("/no-multipart");

    // explicit non-multipart content-type to avoid header access errors
    request.setHeaders({ "content-type": "text/plain" });
    request.setData({ hello: "world" });

    const mw = uploader.single("missing");

    await mw(request, next);

    expect(request.file).toBeUndefined();
    expect(request.data.hello).toBe("world");
  });

  it("array() accepts multiple files and enforces maxCount", async () => {
    const uploader = createUploader({
      storageType: StorageType.MEMORY,
      storageOptions: { memory: {} },
    });

    const request = new Request("/arr");
    request.setHeaders({ "content-type": "multipart/form-data" });
    request.setData({
      fields: {},
      files: [makeFile("photos", "1.png"), makeFile("photos", "2.png")],
    });

    const mw = uploader.array("photos", 2);

    await mw(request, next);

    expect(Array.isArray(request.files)).toBe(true);
    expect(request.files.length).toBe(2);

    const badReq = new Request("/arr-bad");
    badReq.setHeaders({ "content-type": "multipart/form-data" });
    badReq.setData({
      fields: {},
      files: [makeFile("photos", "a"), makeFile("photos", "b")],
    });

    const mwOne = uploader.array("photos", 1);

    await expect(mwOne(badReq, next)).rejects.toHaveProperty(
      "code",
      UploadErrorCode.LIMIT_FILE_COUNT,
    );
  });

  it("fields() rejects unexpected field", async () => {
    const uploader = createUploader({
      storageType: StorageType.MEMORY,
      storageOptions: { memory: {} },
    });

    const request = new Request("/fields");
    request.setHeaders({ "content-type": "multipart/form-data" });
    request.setData({ fields: {}, files: [makeFile("unlisted", "x.txt")] });

    const mw = uploader.fields([{ name: "avatar", maxCount: 1 }]);

    await expect(mw(request, next)).rejects.toHaveProperty(
      "code",
      UploadErrorCode.LIMIT_UNEXPECTED_FILE,
    );
  });

  it("any() enforces global files limit", async () => {
    const uploader = createUploader({
      storageType: StorageType.MEMORY,
      limits: { files: 1 },
      storageOptions: { memory: {} },
    });

    const request = new Request("/any");
    request.setHeaders({ "content-type": "multipart/form-data" });
    request.setData({
      fields: {},
      files: [makeFile("a", "1"), makeFile("b", "2")],
    });

    const mw = uploader.any();

    await expect(mw(request, next)).rejects.toHaveProperty(
      "code",
      UploadErrorCode.LIMIT_FILE_COUNT,
    );
  });

  it("none() throws when files are present and merges fields otherwise", async () => {
    const uploader = createUploader({
      storageType: StorageType.MEMORY,
      storageOptions: { memory: {} },
    });

    const reqWithFile = new Request("/none");
    reqWithFile.setHeaders({ "content-type": "multipart/form-data" });
    reqWithFile.setData({ fields: {}, files: [makeFile("f", "1")] });

    const mw = uploader.none();

    await expect(mw(reqWithFile, next)).rejects.toHaveProperty(
      "code",
      UploadErrorCode.LIMIT_UNEXPECTED_FILE,
    );

    const reqNoFile = new Request("/none-ok");
    reqNoFile.setHeaders({ "content-type": "multipart/form-data" });
    reqNoFile.setData({ fields: { a: "b" }, files: [] });

    await mw(reqNoFile, next);
    expect(reqNoFile.data.a).toBe("b");
  });

  it("applies fileFilter and rejects invalid types", async () => {
    const uploader = createUploader({
      storageType: StorageType.MEMORY,
      fileFilter: (req, file, cb) => cb(null, false),
      storageOptions: { memory: {} },
    });

    const req = new Request("/filter");
    req.setHeaders({ "content-type": "multipart/form-data" });
    req.setData({ fields: {}, files: [makeFile("x", "p")] });

    const mw = uploader.single("x");

    await expect(mw(req, next)).rejects.toHaveProperty(
      "code",
      UploadErrorCode.INVALID_FILE_TYPE,
    );
  });

  it("enforces per-file size limit", async () => {
    const uploader = createUploader({
      storageType: StorageType.MEMORY,
      limits: { fileSize: 1 },
      storageOptions: { memory: {} },
    });

    const req = new Request("/size");
    req.setHeaders({ "content-type": "multipart/form-data" });
    req.setData({ fields: {}, files: [makeFile("f", "big", "too big")] });

    const mw = uploader.single("f");

    await expect(mw(req, next)).rejects.toHaveProperty(
      "code",
      UploadErrorCode.LIMIT_FILE_SIZE,
    );
  });
});
