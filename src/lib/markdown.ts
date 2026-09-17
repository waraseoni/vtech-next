const CODE_MARK = "\u0000";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

function renderInline(raw: string): string {
  let out = escapeHtml(raw);
  const codes: string[] = [];

  out = out.replace(/`([^`]+)`/g, (_match, code: string) => {
    codes.push(code);
    return `${CODE_MARK}${codes.length - 1}${CODE_MARK}`;
  });

  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, text: string, href: string) => `<a href="${href}">${text}</a>`
  );

  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  out = out.replace(
    new RegExp(`${CODE_MARK}(\\d+)${CODE_MARK}`, "g"),
    (_match, index: string) => `<code>${codes[Number(index)]}</code>`
  );

  return out;
}

type ListItem = { indent: number; ordered: boolean; text: string };

const LIST_RE = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const HR_RE = /^\s*-{3,}\s*$/;

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderList(items: ListItem[]): string {
  const baseIndent = Math.min(...items.map((item) => item.indent));
  const indentUnit = items.some((item) => item.indent > baseIndent) ? 2 : 1;
  let html = "";
  let index = 0;

  while (index < items.length) {
    const ordered = items[index].ordered;
    const tag = ordered ? "ol" : "ul";
    html += `<${tag}>`;

    while (
      index < items.length &&
      items[index].indent === baseIndent &&
      items[index].ordered === ordered
    ) {
      const item = items[index];
      index += 1;
      const children: ListItem[] = [];
      while (index < items.length && items[index].indent > baseIndent) {
        children.push(items[index]);
        index += 1;
      }
      const childHtml = children.length
        ? renderList(
            children.map((child) => ({
              ...child,
              indent: Math.max(baseIndent, child.indent - indentUnit),
            }))
          )
        : "";
      html += `<li>${renderInline(item.text)}${childHtml}</li>`;
    }

    html += `</${tag}>`;
  }

  return html;
}

export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    if (line.trimStart().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      index += 1;
      const buffer: string[] = [];
      while (index < lines.length && !lines[index].trimStart().startsWith("```")) {
        buffer.push(lines[index]);
        index += 1;
      }
      index += 1;
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      html.push(`<pre><code${cls}>${escapeHtml(buffer.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      html.push(`<h${level} id="${slugify(text)}">${renderInline(text)}</h${level}>`);
      index += 1;
      continue;
    }

    if (HR_RE.test(line)) {
      html.push("<hr/>");
      index += 1;
      continue;
    }

    if (line.trimStart().startsWith(">")) {
      const buffer: string[] = [];
      while (index < lines.length && lines[index].trimStart().startsWith(">")) {
        buffer.push(lines[index].trimStart().replace(/^>\s?/, ""));
        index += 1;
      }
      html.push(`<blockquote>${renderInline(buffer.join(" "))}</blockquote>`);
      continue;
    }

    if (line.trimStart().startsWith("|") && TABLE_SEP_RE.test(lines[index + 1] ?? "")) {
      const header = splitRow(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trimStart().startsWith("|")) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      const headHtml = header.map((cell) => `<th>${renderInline(cell)}</th>`).join("");
      const bodyHtml = rows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`
        )
        .join("");
      html.push(
        `<table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`
      );
      continue;
    }

    if (LIST_RE.test(line)) {
      const items: ListItem[] = [];
      while (index < lines.length && LIST_RE.test(lines[index])) {
        const match = lines[index].match(LIST_RE) as RegExpMatchArray;
        items.push({
          indent: match[1].length,
          ordered: /\d+\./.test(match[2]),
          text: match[3],
        });
        index += 1;
      }
      html.push(renderList(items));
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() !== "" &&
      !HEADING_RE.test(lines[index]) &&
      !HR_RE.test(lines[index]) &&
      !lines[index].trimStart().startsWith("|") &&
      !lines[index].trimStart().startsWith(">") &&
      !lines[index].trimStart().startsWith("```") &&
      !LIST_RE.test(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
  }

  return html.join("\n");
}
