function test() {
  const chr = document.forms.form.chrname.value;
  const start = document.forms.form.start.value;
  const end = document.forms.form.end.value;
  const cram = document.forms.form.cram.value;
  const crai = document.forms.form.crai.value;
  console.log(chr);
  console.log(start);
  console.log(end)
  console.log(cram);
  console.log(crai);
  var c = new CramFile(cram, crai);
  const chrName = "chr22";
  const start = 50199000;
  const end = 50200000;
  const  result = c.getRecords(chrName, start, end);
  result.forEach(r => {
    console.log(r);
  });
}