import OrigJsPDF from "jspdf";
let lastBuf = null;
let lastFilename = null;
function patch(inst) {
  inst.save = function (filename) {
    lastFilename = filename;
    lastBuf = Buffer.from(this.output("arraybuffer"));
    return this;
  };
  return inst;
}
const Wrapped = function (...args) { return patch(new OrigJsPDF(...args)); };
Wrapped.prototype = OrigJsPDF.prototype;
Object.assign(Wrapped, OrigJsPDF);
globalThis.__jsPDFWrap = { Wrapped, get: () => ({ buf: lastBuf, filename: lastFilename }), reset: () => { lastBuf = null; lastFilename = null; } };
