function testLocal() {
    const chr = document.forms.form.chrnameLocal.value;
    const start = document.forms.form.startLocal.value;
    const end = document.forms.form.endLocal.value;
    const cram = document.forms.form.cramLocal.files[0];
    const crai = document.forms.form.craiLocal.files[0];
    console.log(chr);
    console.log(start);
    console.log(end)
    console.log(cram);
    console.log(crai);
    var c = new Cram(cram, crai, true);
    c.getRecords(chr, start, end).then((reads) => {
        reads.forEach(r => {
            console.log(r);
        })
        console.log("finished.");
    });
}

function testRemote() {
    const chr = document.forms.form.chrnameRemote.value;
    const start = document.forms.form.startRemote.value;
    const end = document.forms.form.endRemote.value;
    const cram = document.forms.form.cramRemote.files[0];
    const crai = document.forms.form.craiRemote.files[0];
    console.log(chr);
    console.log(start);
    console.log(end)
    console.log(cram);
    console.log(crai);
    var c = new Cram(cram, crai, false);
    c.getRecords(chr, start, end).then((reads) => {
        reads.forEach(r => {
            console.log(r);
        })
        console.log("finished.");
    });
}