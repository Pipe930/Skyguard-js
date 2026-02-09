import { ContentDisposition } from "@static/contentDisposition";

describe("ContentDispositionTest", () => {
  let contentDisposition: ContentDisposition;

  beforeEach(() => {
    contentDisposition = new ContentDisposition();
  });
  it("should generate an attachment header for ASCII filenames", () => {
    expect(contentDisposition.attachment("report.pdf")).toBe(
      'attachment; filename="report.pdf"',
    );
  });

  it("should sanitize dangerous characters in ASCII filenames", () => {
    const header = contentDisposition.attachment('  re"po\r\nrt/..\\x  .pdf  ');
    expect(header).toBe('attachment; filename="report..x .pdf"');
  });

  it("should remove control characters from filenames", () => {
    const header = contentDisposition.attachment("re\u0000po\u001Frt.pdf");
    expect(header).toBe('attachment; filename="report.pdf"');
  });

  it("should include RFC8187 filename* when non-ASCII is present", () => {
    const header = contentDisposition.attachment("reporte año 2024.pdf");
    expect(header).toContain('attachment; filename="reporte ano 2024.pdf"');
    expect(header).toContain("filename*=UTF-8''");
    expect(header).toContain("reporte%20a%C3%B1o%202024.pdf");
  });

  it("should remove quotes from the ASCII fallback when encoding is needed", () => {
    const header = contentDisposition.attachment('año "2024".pdf');

    expect(header).toContain('filename="ano 2024.pdf"');
    expect(header).toContain("filename*=UTF-8''");
    expect(header).toContain("a%C3%B1o%202024.pdf");
  });

  it("should throw when filename is empty", () => {
    expect(() => contentDisposition.attachment("")).toThrow();
  });

  it("should generate an inline header for ASCII filenames", () => {
    expect(contentDisposition.inline("image.jpg")).toBe(
      'inline; filename="image.jpg"',
    );
  });

  it("should include RFC8187 filename* for non-ASCII inline filenames", () => {
    const header = contentDisposition.inline("mañana.png");
    expect(header).toContain('inline; filename="manana.png"');
    expect(header).toContain("filename*=UTF-8''ma%C3%B1ana.png");
  });

  it("should parse type and ASCII filename from a basic header", () => {
    const parsed = contentDisposition.parse(
      'attachment; filename="report.pdf"',
    );
    expect(parsed).toEqual({ type: "attachment", filename: "report.pdf" });
  });

  it("should parse filename without quotes", () => {
    const parsed = contentDisposition.parse("inline; filename=photo.jpg");
    expect(parsed).toEqual({ type: "inline", filename: "photo.jpg" });
  });

  it("should prefer filename* over filename when both are present", () => {
    const parsed = contentDisposition.parse(
      "attachment; filename=\"fallback.txt\"; filename*=UTF-8''real%20name.txt",
    );
    expect(parsed).toEqual({ type: "attachment", filename: "real name.txt" });
  });

  it("should decode RFC8187 percent-encoded UTF-8 filenames", () => {
    const parsed = contentDisposition.parse(
      "attachment; filename*=UTF-8''reporte%20a%C3%B1o.pdf",
    );
    expect(parsed).toEqual({
      type: "attachment",
      filename: "reporte año.pdf",
    });
  });

  it("should unescape escaped quotes inside filename", () => {
    const parsed = contentDisposition.parse(
      'attachment; filename="a \\"quote\\".txt"',
    );
    expect(parsed).toEqual({ type: "attachment", filename: 'a "quote".txt' });
  });

  it("should return null filename when header has no filename parameters", () => {
    const parsed = contentDisposition.parse("attachment");
    expect(parsed).toEqual({ type: "attachment", filename: null });
  });

  it("should handle extra parameters and whitespace", () => {
    const parsed = contentDisposition.parse(
      'attachment ;  filename="x.txt" ; size=123 ',
    );
    expect(parsed).toEqual({ type: "attachment", filename: "x.txt" });
  });
});
