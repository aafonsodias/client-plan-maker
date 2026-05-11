import jsPDF from 'jspdf';
import fs from 'fs';
(jsPDF.prototype as any).save = function(name: string) {
  fs.writeFileSync('/tmp/pdfqa/' + name, Buffer.from(this.output('arraybuffer')));
  console.log('wrote', name, 'pages=', this.getNumberOfPages());
};
const m = await import('../src/lib/trainer-resource-pdf');
m.downloadTrainerAcquisitionRetentionPdf('pt');
