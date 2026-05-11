import jsPDF from 'jspdf';
import fs from 'fs';
(jsPDF.prototype as any).save = function(name: string) {
  console.log('SAVE', name, 'pages=', this.getNumberOfPages());
  fs.writeFileSync('/tmp/pdfqa/' + name, Buffer.from(this.output('arraybuffer')));
};
try {
  const m = await import('../src/lib/trainer-resource-pdf');
  m.downloadTrainerAcquisitionRetentionPdf('pt');
} catch (e) {
  console.error('ERR', e);
}
