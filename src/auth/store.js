import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { memoryAdapter } from "@better-auth/memory-adapter";

/**
 * Persistent key/value-file backed store for Better Auth.
 *
 * better-auth needs a database; this machine has no native build toolchain,
 * so instead of SQLite we persist the in-memory adapter's plain-object store
 * to a JSON file after every mutating operation. Suitable for the campaign's
 * single-process war-room API (a real DB applies if it ever multi-processes).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const STORE_FILE =
  process.env.AUTH_STORE_FILE ||
  path.join(__dirname, "..", "..", "data", "auth-store.json");

const MODELS = ["user", "session", "account", "verification"];

function freshStore() {
  return Object.fromEntries(MODELS.map((m) => [m, []]));
}

export function loadStoreFromDisk() {
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
    const store = freshStore();
    for (const m of MODELS) if (Array.isArray(raw[m])) store[m] = raw[m];
    return store;
  } catch {
    return freshStore();
  }
}

/** Live store object — mutate through the adapter so writes are persisted. */
export const store = loadStoreFromDisk();

let saveQueued = false;
/**
 * Async, coalesced file flush. One write at a time; requests that arrive
 * while a flush is in-flight are absorbed into the next flush.
 */
export function persistStore() {
  if (saveQueued) return;
  saveQueued = true;
  fs.mkdir(path.dirname(STORE_FILE), { recursive: true }, () => {
    fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), () => {
      saveQueued = false;
    });
  });
}

const MUTATING_OPS = new Set(["create", "update", "updateMany", "delete", "deleteMany", "consumeOne", "incrementOne"]);

/**
 * Better Auth adapter factory backed by the live `store` object; every
 * mutating operation triggers a persisted snapshot. `anonymous`/`oneTimeToken`
 * style ops are covered; reads never persist.
 */
const raw = memoryAdapter(store);

export const authStoreAdapter = (options) => {
  const instance = raw(options);
  const wrapped = {};
  for (const name of Object.keys(instance)) {
    if (MUTATING_OPS.has(name)) {
      wrapped[name] = async (args) => {
        const res = await instance[name](args);
        persistStore();
        return res;
      };
    } else {
      wrapped[name] = instance[name];
    }
  }
  return wrapped;
};