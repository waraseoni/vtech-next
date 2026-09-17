import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  isBackupFileName,
  isBucketExistsError,
  deleteLocalBackup,
  readLocalBackup,
  BACKUP_DIR,
} from "./scheduledBackup";

describe("isBucketExistsError", () => {
  it("duplicate bucket ko harmless maanta hai (400/409)", () => {
    expect(isBucketExistsError(409, "")).toBe(true);
    expect(isBucketExistsError(400, '{"error":"Duplicate","message":"The resource already exists"}')).toBe(true);
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
