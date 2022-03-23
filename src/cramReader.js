class CramReader {
  constructor(cram, crai, local_flag, fa, fai) {
    if (!window.Worker) {
      throw "Web Workers API is needed";
    }
    if (!cram || !crai) {
      throw "Files are Falsy";
    }
    this.listeners_ = new Map();
    this.worker_ = new Worker("cram-reader-worker.min.js");
    this.worker_.cram_reader = this;
    this.worker_.onmessage = function (event) {
      this.cram_reader.eventListener_(event);
    };
    this.sendQuery_("init", [cram, crai, local_flag, fa, fai], undefined);
  }

  getRecords(chr, start, end, callback) {
    this.sendQuery_("read", [chr, start, end], callback);
  }

  setOnerror(func) {
    this.worker_.onerror = func;
  }

  sendQuery_(fname, args, callback) {
    var uuid;
    while (true) {
      var generated = this.generateUUID4_();
      if (!this.listeners_.has(generated)) {
        uuid = generated;
        break;
      }
    }
    this.listeners_.set(uuid, callback);
    this.worker_.postMessage([uuid, fname, args]);
  }

  eventListener_(event) {
    var callbackfunc = this.listeners_.get(event.data[0]);
    this.listeners_.delete(event.data[0]);
    if (callbackfunc) {
      callbackfunc(event.data[1]);
    }
  }

  generateUUID4_() {
    var format = "RRRRRRRR-RRRR-4RRR-rRRR-RRRRRRRRRRRR";
    for (var i = 0; i < format.length; i++) {
      switch (format.charAt(i)) {
        case "R":
          format = format.replace(
            "R",
            Math.floor(Math.random() * 16).toString(16)
          );
          break;
        case "r":
          format = format.replace(
            "r",
            (Math.floor(Math.random() * 4) + 8).toString(16)
          );
          break;
      }
    }
    return format;
  }
}
