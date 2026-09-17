import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders headings with GitHub-style ids", () => {
    const html = renderMarkdown("# हिंदी गाइड\n\n## 1. Setup");
    expect(html).toContain('<h1 id="हिंदी-गाइड">हिंदी गाइड</h1>');
    expect(html).toContain('<h2 id="1-setup">1. Setup</h2>');
  });

  it("renders fenced code blocks escaped", () => {
    const html = renderMarkdown("```powershell\nnode a.mjs --dir \"D:\\x\"\n```");
    expect(html).toContain('<pre><code class="language-powershell">');
    expect(html).toContain("&quot;D:\\x&quot;");
  });

  it("renders tables with header and body rows", () => {
    const html = renderMarkdown("| A | B |\n|---|---|\n| **x** | `y` |");
    expect(html).toContain("<table><thead><tr><th>A</th><th>B</th></tr></thead>");
    expect(html).toContain("<tbody><tr><td><strong>x</strong></td><td><code>y</code></td></tr></tbody>");
  });

  it("renders nested unordered lists", () => {
    const html = renderMarkdown("- top\n  - child\n- next");
    expect(html).toContain("<ul><li>top<ul><li>child</li></ul></li><li>next</li></ul>");
  });

  it("renders ordered lists and blockquotes and links", () => {
    const html = renderMarkdown("1. one\n2. two\n\n> note [x](#a)");
    expect(html).toContain("<ol><li>one</li><li>two</li></ol>");
    expect(html).toContain('<blockquote>note <a href="#a">x</a></blockquote>');
  });

  it("does not treat single asterisks as emphasis", () => {
    const html = renderMarkdown("file vtech_backup_*.json");
    expect(html).toContain("vtech_backup_*.json");
    expect(html).not.toContain("<em>");
  });

  it("renders horizontal rules", () => {
    expect(renderMarkdown("a\n\n---\n\nb")).toContain("<hr/>");
  });
});
