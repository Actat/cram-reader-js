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
    this.worker_.onmessage = function (event) {
      var callbackfunc = this.listeners_.get(event.data[0]);
      this.listeners_.delete(event.data[0]);
      if (callbackfunc) {
        callbackfunc(event.data[1]);
      }
    };
    this.sendQuery_("init", [cram, crai, local_flag, fa, fai], undefined);
  }

  getRecords(chr, start, end, callback) {
    if (callback) {
      this.worker_.onmessage = function (result) {
        callback(result);
      };
    }
    this.sendQuery_("read", [chr, start, end], callback);
  }

  sendQuery_(fname, args, callback) {
    var uuid = this.generateUUID4_();
    this.listeners_.set(uuid, callback);
    this.worker_.postMessage([uuid, fname, args]);
  }

  generateUUID4_() {
    var format = "RRRRRRRR-RRRR-4RRR-rRRR-RRRRRRRRRRRR";
    for (var i = 0; i < format.length; i++) {
      switch (format[i]) {
        case "R":
          format[i] = Math.floor(Math.random() * 16).toString(16);
          break;
        case "r":
          format[i] = (Math.floor(Math.random() * 4) + 8).toString(16);
          break;
      }
    }
    return format.join();
  }
}
