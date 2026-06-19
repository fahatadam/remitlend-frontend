export type CsvRow = Record<string, string | number | boolean | null | undefined>;

// UTF-8 BOM so Excel renders non-ASCII characters correctly
const UTF8_BOM = "\uFEFF";

/**
 * Escape a single CSV field per RFC 4180:
 * - Wrap in double-quotes if the value contains a comma, double-quote,
 *   newline (\n), or carriage return (\r).
 * - Escape any double-quote inside the value by doubling it ("").
 */
function escapeCsvValue(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

/**
 * Convert an array of rows to a RFC 4180-compliant CSV string with a
 * UTF-8 BOM prepended.
 *
 * For large datasets the work is chunked so the caller can use
 * `rowsToCsvChunked` to avoid blocking the main thread.
 *
 * @param rows    Array of objects to serialise.
 * @param headers Optional ordered list of column keys / display labels.
 *                When provided as `{ key, label }` pairs the label is used
 *                as the column header while the key is used to read from the
 *                row object.  When provided as plain strings the same value
 *                is used for both.
 */
export function rowsToCsv(
  rows: CsvRow[],
  headers?: string[] | Array<{ key: string; label: string }>,
): string {
  const normalised = normaliseHeaders(headers, rows);

  if (rows.length === 0) {
    const headerLine = normalised.map((h) => escapeCsvValue(h.label)).join(",");
    return headerLine ? `${UTF8_BOM}${headerLine}\n` : UTF8_BOM;
  }

  const lines: string[] = [
    normalised.map((h) => escapeCsvValue(h.label)).join(","),
    ...rows.map((row) =>
      normalised
        .map((h) => {
          const raw = row[h.key];
          const value = raw === null || raw === undefined ? "" : String(raw);
          return escapeCsvValue(value);
        })
        .join(","),
    ),
  ];

  return `${UTF8_BOM}${lines.join("\n")}\n`;
}

/**
 * Convert rows to CSV in chunks of `chunkSize` to avoid blocking the main
 * thread for large exports.  Returns a Promise so it can be awaited or used
 * inside a Web Worker friendly wrapper.
 */
export async function rowsToCsvAsync(
  rows: CsvRow[],
  headers?: string[] | Array<{ key: string; label: string }>,
  chunkSize = 500,
): Promise<string> {
  const normalised = normaliseHeaders(headers, rows);

  const headerLine = normalised.map((h) => escapeCsvValue(h.label)).join(",");
  const parts: string[] = [`${UTF8_BOM}${headerLine}\n`];

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const chunkLines = chunk.map((row) =>
      normalised
        .map((h) => {
          const raw = row[h.key];
          const value = raw === null || raw === undefined ? "" : String(raw);
          return escapeCsvValue(value);
        })
        .join(","),
    );
    parts.push(chunkLines.join("\n") + "\n");

    // Yield to the event loop between chunks
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  return parts.join("");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

/**
 * Async variant — builds the CSV off the main thread in chunks then triggers
 * the download.  Prefer this for exports with more than a few hundred rows.
 */
export async function downloadCsvAsync(
  filename: string,
  rows: CsvRow[],
  headers?: string[] | Array<{ key: string; label: string }>,
): Promise<void> {
  const csv = await rowsToCsvAsync(rows, headers);
  downloadCsv(filename, csv);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface NormalisedHeader {
  key: string;
  label: string;
}

function normaliseHeaders(
  headers: string[] | Array<{ key: string; label: string }> | undefined,
  rows: CsvRow[],
): NormalisedHeader[] {
  if (!headers) {
    const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    return keys.map((k) => ({ key: k, label: k }));
  }

  return headers.map((h) => {
    if (typeof h === "string") return { key: h, label: h };
    return h;
  });
}
