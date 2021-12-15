function testLocal() {
  const chr = document.forms.formLocal.chrnameLocal.value;
  const start = document.forms.formLocal.startLocal.value;
  const end = document.forms.formLocal.endLocal.value;
  const cram = document.forms.formLocal.cramLocal.files[0];
  const crai = document.forms.formLocal.craiLocal.files[0];
  console.log(chr);
  console.log(start);
  console.log(end);
  console.log(cram);
  console.log(crai);
  changeState("Loading local file...");
  var c = new Cram(cram, crai, true);
  c.getRecords(chr, start, end).then((reads) => {
    var result = new String();
    reads.forEach((r) => {
      console.log(r);
      result += r.toSAMString() + "\n";
    });
    changeState(result);
    console.log(result);
    console.log("finished.");
  });
}

function testRemote() {
  const chr = document.forms.formRemote.chrnameRemote.value;
  const start = document.forms.formRemote.startRemote.value;
  const end = document.forms.formRemote.endRemote.value;
  const cram = document.forms.formRemote.cramRemote.value;
  const crai = document.forms.formRemote.craiRemote.value;
  console.log(chr);
  console.log(start);
  console.log(end);
  console.log(cram);
  console.log(crai);
  var c = new Cram(cram, crai, false);
  changeState("Loading remote file...");
  c.getRecords(chr, start, end).then((reads) => {
    var result = new String();
    reads.forEach((r) => {
      console.log(r);
      result += r.toSAMString() + "\n";
    });
    changeState(result);
    console.log(result);
    console.log("finished.");
  });
}

function changeState(str) {
  const elem = document.getElementById("state");
  elem.innerHTML = str;
}
