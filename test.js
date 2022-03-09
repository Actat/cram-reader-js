window.onload = function () {
  let elmL = document.getElementById("button_local");
  elmL.addEventListener("click", (e) => {
    testLocal();
  });

  let elmR = document.getElementById("button_remote");
  elmR.addEventListener("click", (e) => {
    testRemote();
  });
};

function testLocal() {
  const chr = document.forms.formLocal.chrnameLocal.value;
  const start = document.forms.formLocal.startLocal.value;
  const end = document.forms.formLocal.endLocal.value;
  const cram = document.forms.formLocal.cramLocal.files[0];
  const crai = document.forms.formLocal.craiLocal.files[0];
  const fa = document.forms.formLocal.faLocal.files[0];
  const fai = document.forms.formLocal.faiLocal.files[0];
  console.log(chr);
  console.log(start);
  console.log(end);
  console.log(cram);
  console.log(crai);
  console.log(fa);
  console.log(fai);
  if (window.Worker) {
    changeState("Loading local file...");
    var worker = new Worker("src/worker.js");
    worker.postMessage([cram, crai, true, fa, fai]);
    worker.onmessage = function (reads) {
      var result = new String();
      reads.forEach((r) => {
        console.log(r);
        result += r.toSAMString() + "\n";
      });
      changeState(result);
      console.log(result);
      console.log("finished.");
    };
    worker.onerror = function (reason) {
      console.log(reason);
      changeState("Error occurred. (" + reason + ")");
    };
  }
}

function testRemote() {
  const chr = document.forms.formRemote.chrnameRemote.value;
  const start = document.forms.formRemote.startRemote.value;
  const end = document.forms.formRemote.endRemote.value;
  const cram = document.forms.formRemote.cramRemote.value;
  const crai = document.forms.formRemote.craiRemote.value;
  const fa = document.forms.formRemote.faRemote.value;
  const fai = document.forms.formRemote.faiRemote.value;
  console.log(chr);
  console.log(start);
  console.log(end);
  console.log(cram);
  console.log(crai);
  console.log(fa);
  console.log(fai);
  if (window.Worker) {
    changeState("Loading remote file...");
    var worker = new Worker("src/worker.js");
    worker.postMessage([cram, crai, false, fa, fai]);
    worker.onmessage = function (reads) {
      var result = new String();
      reads.forEach((r) => {
        console.log(r);
        result += r.toSAMString() + "\n";
      });
      changeState(result);
      console.log(result);
      console.log("finished.");
    };
    worker.onerror = function (reason) {
      console.log(reason);
      changeState("Error occurred. (" + reason + ")");
    };
  }
}

function changeState(str) {
  const elem = document.getElementById("state");
  elem.innerHTML = str;
}
