var cram = undefined;

onmessage = function (data) {
  var uuid = data.data[0];
  var fname = data.data[1];
  var args = data.data[2];

  switch (fname) {
    case "init":
      cram = new Cram(args[0], args[1], args[2], args[3], args[4]);
      postMessage([uuid]);
      break;
    case "read":
      var reads = cram
        .getRecords(args[0], args[1], args[2])
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
      postMessage([uuid, reads]);
      break;
  }
};
