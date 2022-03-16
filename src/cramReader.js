class CramReader {
  constructor(cram, crai, local_flag, fa, fai) {
    if (!window.Worker) {
      throw "Web Workers API is needed";
    }
    if (!cram || !crai) {
      throw "Files are Falsy";
    }
    this.cram_ = new Cram(cram, crai, local_flag, fa, fai);
    this.worker_ = new Worker("cram-reader-worker.min.js");
  }

  getRecords(chr, start, end, callback, onerror) {
    if (callback) {
      this.worker_.onmessage = function (result) {
        callback(result);
      };
    }
    if (onerror) {
      this.worker_.onerror = function (error) {
        onerror(error);
      };
    }
    this.worker_.postMessage([this.cram_, chr, start, end]);
  }
}
