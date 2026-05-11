console.log('start qa');
import('jspdf').then(async (jp) => {
  const fs = await import('fs');
  (jp.default.prototype as any).save = function(name: string) {
    fs.writeFileSync('/tmp/pdfqa/' + name, Buffer.from(this.output('arraybuffer')));
    console.log('wrote', name, 'pages=', this.getNumberOfPages());
  };
  const m = await import('../src/lib/trainer-resource-pdf');
  console.log('module', Object.keys(m));
  m.downloadTrainerAcquisitionRetentionPdf('pt');
  m.downloadTrainerAcquisitionRetentionPdf('en');
});
