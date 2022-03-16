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
      cram
        .getRecords(args[0], args[1], args[2])
        .then((reads) => {
          postMessage([uuid, reads]);
        })
        .catch((reason) => {
          console.error(reason);
        });
      break;
  }
};
