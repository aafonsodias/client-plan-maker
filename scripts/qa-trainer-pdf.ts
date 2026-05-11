import jsPDF from 'jspdf';
import fs from 'fs';
const orig = jsPDF.prototype.save;
(jsPDF.prototype as any).save = function(name: string) {
  console.log('SAVE CALLED', name, 'pages=', this.getNumberOfPages());
  fs.writeFileSync('/tmp/pdfqa/' + name, Buffer.from(this.output('arraybuffer')));
};
const m = await import('../src/lib/trainer-resource-pdf');
m.downloadTrainerAcquisitionRetentionPdf('pt');
m.downloadTrainerAcquisitionRetentionPdf('en');
console.log('done');
