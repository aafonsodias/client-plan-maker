// Inline a copy of helper, but call doc.output directly instead of save.
// Simpler: replicate just enough — actually call the real helper but override
// by replacing jsPDF default with a Proxy via bun preload.
// Cleanest: just patch the prototype method `output` to capture before save runs.
// jsPDF.save calls this.output("save", filename) internally — we wrap output.
import jsPDF from "jspdf";
import fs from "node:fs";

let lastBuf = null;
let lastFilename = null;
const origOutput = jsPDF.API ? jsPDF.API.output : null;
console.log("API?", !!jsPDF.API, "API.output?", typeof origOutput);

// Wrap save by patching the constructor via subclass; helper imports default
// which is the same class, so subclassing won't help unless we replace export.
// Final path: register a bun-preload that swaps the default export.
