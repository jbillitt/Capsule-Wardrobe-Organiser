/**
 * The disk store's one job: never lose a wardrobe that was already saved.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The store resolves its paths from cwd at call time, so each test gets a
// throwaway directory to work in.
const realCwd = process.cwd();
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "wardrobe-store-"));
process.chdir(sandbox);

const store = await import("./wardrobeStore.js");

test.after(() => {
  process.chdir(realCwd);
  fs.rmSync(sandbox, { recursive: true, force: true });
});

const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, item: `Garment ${i}` }));

test("nothing saved yet reads as nothing, not as an error", () => {
  assert.equal(store.readWardrobe(), null);
});

test("a saved wardrobe comes back intact", () => {
  const outcome = store.writeWardrobe(items(12), [], false);
  assert.equal(outcome.ok, true);
  assert.equal(store.readWardrobe()?.wardrobe.length, 12);
});

test("an empty save is refused, and changes nothing", () => {
  const outcome = store.writeWardrobe([], [], false);
  assert.equal(outcome.ok, false);
  assert.equal(outcome.refused, true);
  assert.equal(store.readWardrobe()?.wardrobe.length, 12, "the saved wardrobe survived");
});

test("the previous wardrobe is snapshotted before being overwritten", () => {
  store.writeWardrobe(items(3), [], false);
  const backups = store.listBackups();
  assert.ok(backups.length >= 1, "a snapshot was written");
  assert.equal(store.readBackup(backups[0].file)?.wardrobe.length, 12, "the snapshot holds the older copy");
});

test("clearing on purpose is allowed, and the old copy is still on disk", () => {
  const outcome = store.writeWardrobe([], [], true);
  assert.equal(outcome.ok, true);
  assert.equal(store.readWardrobe()?.wardrobe.length, 0);
  assert.equal(store.listBackups()[0].items, 3, "the wardrobe we just cleared is recoverable");
});

test("a backup name cannot escape the backup directory", () => {
  assert.equal(store.readBackup("../wardrobe.json"), null);
});

test("an unreadable file is parked, never silently replaced", () => {
  fs.writeFileSync(path.join(sandbox, "data", "wardrobe.json"), "{ this is not json");
  assert.equal(store.readWardrobe(), null);
  const parked = fs.readdirSync(path.join(sandbox, "data")).filter(f => f.includes("unreadable"));
  assert.equal(parked.length, 1, "the corrupt file was kept");
});
