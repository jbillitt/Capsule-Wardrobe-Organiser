/**
 * The wardrobe is only stored in the browser, so these checks exist to prove
 * one thing: a read we cannot understand never destroys what is already there.
 */

import test from "node:test";
import assert from "node:assert/strict";

// Minimal localStorage for Node. Behaviour, not the browser, is under test.
class MemoryStorage {
  private map = new Map<string, string>();
  private limit: number;
  constructor(limit = Infinity) {
    this.limit = limit;
  }
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    const total = [...this.map.entries()].reduce((n, [key, val]) => (key === k ? n : n + val.length), 0) + v.length;
    if (total > this.limit) {
      const err: any = new Error("The quota has been exceeded.");
      err.name = "QuotaExceededError";
      throw err;
    }
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

function withStorage(store: MemoryStorage | null, run: () => void) {
  (globalThis as any).localStorage = store;
  if (!(globalThis as any).Blob) {
    (globalThis as any).Blob = class {
      size: number;
      constructor(parts: string[]) {
        this.size = Buffer.byteLength(parts.join(""), "utf8");
      }
    };
  }
  try {
    run();
  } finally {
    delete (globalThis as any).localStorage;
  }
}

const load = async () => await import("./storage");

test("a wardrobe that parses is returned intact", async () => {
  const { loadList, WARDROBE_KEY } = await load();
  const store = new MemoryStorage();
  store.setItem(WARDROBE_KEY, JSON.stringify([{ item: "Linen shirt" }, { item: "Jeans" }]));

  withStorage(store, () => {
    const result = loadList(WARDROBE_KEY);
    assert.equal(result.status, "loaded");
    assert.equal(result.items.length, 2);
  });
});

test("an unreadable wardrobe is preserved, never replaced", async () => {
  const { loadList, WARDROBE_KEY } = await load();
  const store = new MemoryStorage();
  const corrupt = '[{"item":"Linen shirt"},{"item":"Jea';
  store.setItem(WARDROBE_KEY, corrupt);

  withStorage(store, () => {
    const result = loadList(WARDROBE_KEY);
    assert.equal(result.status, "unreadable");
    assert.equal(result.items.length, 0, "must not invent items");
    // The whole point: the original bytes are still on disk afterwards.
    assert.equal(store.getItem(WARDROBE_KEY), corrupt, "the stored value must be untouched");
    assert.ok(result.quarantineKey, "a copy should be kept for recovery");
    assert.equal(store.getItem(result.quarantineKey!), corrupt);
    assert.match(result.message, /could not be parsed/i);
  });
});

test("an empty browser is reported as empty, not broken", async () => {
  const { loadList, WARDROBE_KEY } = await load();
  withStorage(new MemoryStorage(), () => {
    const result = loadList(WARDROBE_KEY);
    assert.equal(result.status, "empty");
    assert.equal(result.items.length, 0);
  });
});

test("blocked storage is reported rather than throwing", async () => {
  const { loadList, WARDROBE_KEY } = await load();
  const blocked = {
    get length() {
      return 0;
    },
    key: () => null,
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
    removeItem: () => {},
  };
  withStorage(blocked as any, () => {
    const result = loadList(WARDROBE_KEY);
    assert.equal(result.status, "unavailable");
    assert.match(result.message, /blocking local storage/i);
  });
});

test("a full quota is reported with a usable explanation", async () => {
  const { saveList, WARDROBE_KEY } = await load();
  const store = new MemoryStorage(200);
  withStorage(store, () => {
    const result = saveList(WARDROBE_KEY, [{ item: "x".repeat(500) }]);
    assert.equal(result.ok, false);
    assert.match(result.message, /storage limit/i);
    assert.match(result.message, /export a backup/i);
  });
});

test("a backup round-trips, and a raw item list is also accepted", async () => {
  const { buildBackup, parseBackup } = await load();
  const wardrobe = [{ item: "Linen shirt", imageUrl: "data:image/png;base64,AAA" }] as any;
  const outfits = [{ name: "Test look" }] as any;

  const restored = parseBackup(JSON.stringify(buildBackup(wardrobe, outfits)));
  assert.equal(restored.ok, true);
  assert.equal(restored.wardrobe?.length, 1);
  assert.equal(restored.outfits?.length, 1);
  assert.equal((restored.wardrobe as any)[0].imageUrl, "data:image/png;base64,AAA", "photos must survive");

  // Rescued straight out of another browser's storage.
  const raw = parseBackup(JSON.stringify([{ item: "Jeans" }]));
  assert.equal(raw.ok, true);
  assert.equal(raw.wardrobe?.length, 1);

  assert.equal(parseBackup("not json").ok, false);
  assert.equal(parseBackup('{"format":"something-else"}').ok, false);
});

test("diagnostics find a wardrobe hiding under another key", async () => {
  const { findCandidateKeys } = await load();
  const store = new MemoryStorage();
  store.setItem("capsule_closet_wardrobe", JSON.stringify([]));
  store.setItem("some_old_key", JSON.stringify([{ item: "Linen shirt" }, { item: "Boots" }]));
  store.setItem("unrelated", "hello");

  withStorage(store, () => {
    const keys = findCandidateKeys();
    const found = keys.find(k => k.looksLikeWardrobe);
    assert.ok(found, "a stray array of garments should be spotted");
    assert.equal(found!.key, "some_old_key");
    assert.equal(found!.count, 2);
  });
});
