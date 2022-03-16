onmessage = function (e) {
  var worker_result = e[0]
    .getRecords(e[1], e[2], e[3])
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
