import { webcrypto } from "node:crypto";

if (typeof globalThis.atob !== "function") {
  globalThis.atob = (value: string): string =>
    Buffer.from(value, "base64").toString("binary");
}

if (typeof globalThis.btoa !== "function") {
  globalThis.btoa = (value: string): string =>
    Buffer.from(value, "binary").toString("base64");
}

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
    writable: false,
  });
}
