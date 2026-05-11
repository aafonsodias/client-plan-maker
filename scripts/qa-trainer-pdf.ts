import { downloadTrainerAcquisitionRetentionPdf } from '../src/lib/trainer-resource-pdf';
import jsPDF from 'jspdf';
import fs from 'fs';
const orig = jsPDF.prototype.save;
jsPDF.prototype.save = function(name: string) {
  const buf = Buffer.from(this.output('arraybuffer'));
  fs.writeFileSync('/tmp/pdfqa/' + name, buf);
  console.log('wrote', name, 'pages=', this.getNumberOfPages());
};
downloadTrainerAcquisitionRetentionPdf('pt');
