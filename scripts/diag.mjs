import jsPDF from "jspdf";
const d = new jsPDF();
console.log("hasOwnSave:", Object.prototype.hasOwnProperty.call(d, "save"));
console.log("protoSave:", typeof Object.getPrototypeOf(d).save);
console.log("ctor === jsPDF:", d.constructor === jsPDF);
