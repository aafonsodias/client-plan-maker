import OrigJsPDF from "jspdf";
import fs from "node:fs";

let lastBuf = null;
const Wrapped = new Proxy(OrigJsPDF, {
  construct(target, args) {
    const inst = new target(...args);
    inst.save = function (filename) {
      lastBuf = { filename, buf: Buffer.from(this.output("arraybuffer")) };
      return this;
    };
    return inst;
  },
});

// Replace module export so dynamic import sees wrapped class
import { Module } from "node:module";
// Bun: rely on import alias instead — patch the loaded module cache
import jspdfMod from "jspdf";
jspdfMod.default = Wrapped;

// Instead: monkey-patch by replacing the export getter via a side import indirection.
// Simpler: write a tiny shim that re-exports Wrapped, and have the helper import jspdf normally.
// But helper already imports jspdf. So: patch every newly constructed instance via OrigJsPDF prototype "after construct" hook — there is none. Use a setter on `save` via defineProperty in constructor? Not possible without modifying lib.
// Best path: use bun's preload to swap.
console.log("approach: shim");
