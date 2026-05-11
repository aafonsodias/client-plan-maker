import jsPDF from 'jspdf';
const real = jsPDF as any;
real.prototype.save = function(name: string) {
  const fs = require('fs');
  const buf = Buffer.from(this.output('arraybuffer'));
  fs.writeFileSync('/tmp/pdfqa/' + name, buf);
  console.log('wrote', name, 'pages=', this.getNumberOfPages());
};
const m = await import('../src/lib/trainer-resource-pdf');
m.downloadTrainerAcquisitionRetentionPdf('pt');
