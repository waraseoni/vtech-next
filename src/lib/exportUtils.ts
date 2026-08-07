import { toISTDatePart } from "./dateUtils";

export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; label: string }[]
) {
  if (!data.length) {
    alert("No data to export");
    return;
  }

  const keys = columns ? columns.map((c) => c.key) : Object.keys(data[0]);
  const headers = columns ? columns.map((c) => c.label) : keys;

  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      keys
        .map((key) => {
          const val = row[key];
          if (val === null || val === undefined) return "";
          const str = String(val);
          if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    ),
  ].join("\n");

  // UTF-8 BOM so ₹/Hindi chars don't garble in Excel
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${toISTDatePart(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printTable(tableId: string, title?: string) {
  const table = document.getElementById(tableId);
  if (!table) {
    alert("Table not found");
    return;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const styles = `
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h1 { font-size: 18px; margin-bottom: 10px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
      th { background: #f5f5f5; }
    </style>
  `;

  printWindow.document.write(`
    <html>
      <head>
        <title>${title || "Report"}</title>
        ${styles}
      </head>
      <body>
        ${title ? `<h1>${title}</h1>` : ""}
        ${table.outerHTML}
      </body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
    setTimeout(() => printWindow.close(), 250);
  }, 400);
}
