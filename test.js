function test() {
    const chr = document.forms.form.chrname.value;
    const start = document.forms.form.start.value;
    const end = document.forms.form.end.value;
    const cram = document.forms.form.cram.files[0];
    const crai = document.forms.form.crai.files[0];
    console.log(chr);
    console.log(start);
    console.log(end)
    console.log(cram);
    console.log(crai);
    var c = new Cram(cram, crai, true);
    const  result = c.getRecords(chr, start, end);
    result.forEach(r => {
        console.log(r);
    });
    console.log("finished.");
}