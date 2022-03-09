if (window.Worker) {
  onmessage = function (e) {
    var c = new Cram(e[0], e[1], e[2], e[3], e[4]);
    var worker_result = c
      .getRecords(chr, start, end)
      .then((reads) => {
        var result = new String();
        reads.forEach((r) => {
          console.log(r);
          result += r.toSAMString() + "\n";
        });
        changeState(result);
        console.log(result);
        console.log("finished.");
      })
      .catch((reason) => {
        console.log(reason);
        changeState("Error occurred. (" + reason + ")");
      });
    postMessage(worker_result);
  };
}
