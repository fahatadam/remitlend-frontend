import { rowsToCsv, rowsToCsvAsync } from "../utils/csv";

const UTF8_BOM = "\uFEFF";

describe("rowsToCsv", () => {
  it("prepends UTF-8 BOM", () => {
    const csv = rowsToCsv([{ name: "Alice" }]);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
  });

  it("returns BOM-only string for empty rows with no headers", () => {
    expect(rowsToCsv([])).toBe(UTF8_BOM);
  });

  it("returns header line for empty rows with headers", () => {
    expect(rowsToCsv([], ["Name", "Amount"])).toBe(`${UTF8_BOM}Name,Amount\n`);
  });

  it("wraps fields containing commas in double-quotes (RFC 4180)", () => {
    const csv = rowsToCsv([{ value: "hello, world" }]);
    expect(csv).toContain('"hello, world"');
  });

  it("escapes double-quotes by doubling them (RFC 4180)", () => {
    const csv = rowsToCsv([{ value: 'say "hello"' }]);
    expect(csv).toContain('"say ""hello"""');
  });

  it("wraps fields containing newlines in double-quotes", () => {
    const csv = rowsToCsv([{ value: "line1\nline2" }]);
    expect(csv).toContain('"line1\nline2"');
  });

  it("wraps fields containing carriage returns in double-quotes", () => {
    const csv = rowsToCsv([{ value: "line1\rline2" }]);
    expect(csv).toContain('"line1\rline2"');
  });

  it("handles unicode / non-ASCII characters without corruption", () => {
    const csv = rowsToCsv([{ name: "José", city: "Zürich", emoji: "💸" }]);
    expect(csv).toContain("José");
    expect(csv).toContain("Zürich");
    expect(csv).toContain("💸");
  });

  it("serialises null and undefined as empty strings", () => {
    const csv = rowsToCsv([{ a: null, b: undefined, c: "ok" }]);
    const dataLine = csv.split("\n")[1];
    expect(dataLine).toBe(",,ok");
  });

  it("serialises boolean and number values", () => {
    const csv = rowsToCsv([{ active: true, count: 42 }]);
    expect(csv).toContain("true");
    expect(csv).toContain("42");
  });

  it("respects custom header order", () => {
    const csv = rowsToCsv([{ b: "2", a: "1" }], ["a", "b"]);
    const headerLine = csv.replace(UTF8_BOM, "").split("\n")[0];
    expect(headerLine).toBe("a,b");
    const dataLine = csv.split("\n")[1];
    expect(dataLine).toBe("1,2");
  });

  it("supports { key, label } header pairs for localised column names", () => {
    const csv = rowsToCsv(
      [{ date: "2024-01-01", amount: "100" }],
      [
        { key: "date", label: "Fecha" },
        { key: "amount", label: "Monto" },
      ],
    );
    const headerLine = csv.replace(UTF8_BOM, "").split("\n")[0];
    expect(headerLine).toBe("Fecha,Monto");
    const dataLine = csv.split("\n")[1];
    expect(dataLine).toBe("2024-01-01,100");
  });

  it("does not wrap plain ASCII fields without special characters", () => {
    const csv = rowsToCsv([{ name: "Alice", status: "active" }]);
    expect(csv).toContain("Alice,active");
  });

  it("handles a field that is only a double-quote character", () => {
    const csv = rowsToCsv([{ value: '"' }]);
    expect(csv).toContain('""""');
  });
});

describe("rowsToCsvAsync", () => {
  it("produces identical output to rowsToCsv for small datasets", async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      name: `User ${i}`,
      amount: String(i * 100),
    }));
    const sync = rowsToCsv(rows);
    const asyncResult = await rowsToCsvAsync(rows);
    expect(asyncResult).toBe(sync);
  });

  it("handles large datasets without error", async () => {
    const rows = Array.from({ length: 2000 }, (_, i) => ({
      id: String(i),
      value: `value ${i}`,
    }));
    const csv = await rowsToCsvAsync(rows, undefined, 200);
    const lines = csv.split("\n").filter(Boolean);
    expect(lines.length).toBe(2001);
  });

  it("prepends UTF-8 BOM", async () => {
    const csv = await rowsToCsvAsync([{ x: "1" }]);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
  });
});
