import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  isBackupFileName,
  isBucketExistsError,
  deleteLocalBackup,
  readLocalBackup,
  BACKUP_DIR,
  runScheduledBackup,
} from "./scheduledBackup";

describe("isBucketExistsError", () => {
  it("duplicate bucket ko harmless maanta hai (400/409)", () => {
    expect(isBucketExistsError(409, "")).toBe(true);
    expect(
      isBucketExistsError(400, '{"error":"Duplicate","message":"The resource already exists"}')
    ).toBe(true);
    expect(isBucketExistsError(400, "Bucket already exists")).toBe(true);
  });

  it("asli errors ko reject karta hai", () => {
    expect(isBucketExistsError(400, '{"error":"InvalidRequest"}')).toBe(false);
    expect(isBucketExistsError(401, "Unauthorized")).toBe(false);
    expect(isBucketExistsError(500, "")).toBe(false);
  });
});

describe("isBackupFileName", () => {
  it("apni backup naming accept karta hai", () => {
    expect(isBackupFileName("vtech_backup_2026-09-17T02-00-00.json")).toBe(true);
    expect(isBackupFileName("vtech_backup_abc.123.json")).toBe(true);
  });

  it("baaki sab reject karta hai", () => {
    expect(isBackupFileName("../../etc/passwd")).toBe(false);
    expect(isBackupFileName("vtech_backup_x.txt")).toBe(false);
    expect(isBackupFileName("other_backup_1.json")).toBe(false);
    expect(isBackupFileName("vtech_backup_/../x.json")).toBe(false);
    expect(isBackupFileName("")).toBe(false);
    expect(isBackupFileName(null)).toBe(false);
    expect(isBackupFileName(42)).toBe(false);
  });
});

describe("deleteLocalBackup", () => {
  const created: string[] = [];

  afterEach(() => {
    for (const f of created.splice(0)) fs.rmSync(path.join(BACKUP_DIR, f), { force: true });
  });

  it("valid file ko backups/ se delete karta hai", () => {
    const name = `vtech_backup_test_${Date.now()}.json`;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    fs.writeFileSync(path.join(BACKUP_DIR, name), "{}", "utf8");
    created.push(name);

    expect(fs.existsSync(path.join(BACKUP_DIR, name))).toBe(true);
    deleteLocalBackup(name);
    expect(fs.existsSync(path.join(BACKUP_DIR, name))).toBe(false);
  });

  it("invalid name par throw karta hai", () => {
    expect(() => deleteLocalBackup("../package.json")).toThrow();
  });
});

describe("readLocalBackup", () => {
  const created: string[] = [];

  afterEach(() => {
    for (const f of created.splice(0)) fs.rmSync(path.join(BACKUP_DIR, f), { force: true });
  });

  it("file ka content return karta hai", () => {
    const name = `vtech_backup_read_${Date.now()}.json`;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    fs.writeFileSync(path.join(BACKUP_DIR, name), '{"ok":true}', "utf8");
    created.push(name);

    expect(readLocalBackup(name).toString("utf8")).toBe('{"ok":true}');
  });

  it("missing file aur invalid name par throw karta hai", () => {
    expect(() => readLocalBackup("vtech_backup_missing_xyz.json")).toThrow();
    expect(() => readLocalBackup("../../package.json")).toThrow();
  });
});

describe("runScheduledBackup format 4.0", () => {
  it("writes version 4.0 with schema_snapshot + migration_ids", async () => {
    const originalFetch = globalThis.fetch;
    const spec = {
      definitions: {
        demo_table: {
          required: ["id", "value"],
          properties: {
            id: { description: "Primary Key.<pk/>" },
            value: { description: "" },
          },
        },
      },
    };
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/rest/v1/")) {
        return new Response(JSON.stringify(spec), { status: 200 });
      }
      if (url.includes("select=none")) {
        return new Response("[]", {
          status: 200,
          headers: { "content-range": "0-0/1" },
        });
      }
      if (url.includes("/rest/v1/demo_table?")) {
        return new Response(JSON.stringify([{ id: 1, value: "x" }]), { status: 200 });
      }
      return new Response("{}", { status: 200 }); // storage upload
    }) as typeof fetch;

    let written = "";
    try {
      const result = await runScheduledBackup("https://example.invalid", "test-key");
      expect(result.incomplete).toBe(false);
      expect(result.tables).toBe(1);
      written = result.file;
      const json = JSON.parse(fs.readFileSync(result.file, "utf8"));
      const meta = json._meta[0];
      expect(meta.version).toBe("4.0");
      expect(meta.schema_snapshot.tables.demo_table).toMatchObject({
        cols: ["id", "value"],
        pk: ["id"],
        notNull: ["id", "value"],
        generated: [],
      });
      expect(Array.isArray(meta.schema_snapshot.migration_ids)).toBe(true);
      expect(json.demo_table).toEqual([{ id: 1, value: "x" }]);
    } finally {
      globalThis.fetch = originalFetch;
      if (written) fs.rmSync(written, { force: true });
    }
  });
});
