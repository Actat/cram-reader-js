class FileHandler {
  constructor(
    file /* instance of File object or String of URL */,
    local_flag = true
  ) {
    this.file_ = file;
    this.local_flag_ = local_flag;
  }

  load(pos = -1, length = -1) {
    return new Promise((resolve, reject) => {
      if (this.local_flag_) {
        if (pos >= 0 && length > 0) {
          var sliced = this.file_.slice(pos, pos + length);
          resolve(sliced.arrayBuffer());
        } else {
          resolve(this.file_.arrayBuffer());
        }
      } else {
        var oReq = new XMLHttpRequest();
        oReq.open("GET", this.file_);
        if (pos >= 0 && length > 0) {
          oReq.setRequestHeader(
            "Range",
            "bytes=" + pos + "-" + (pos + length - 1)
          );
        }
        oReq.responseType = "arraybuffer";
        oReq.onload = function (oEvent) {
          const ab = oReq.response;
          if (ab) {
            resolve(ab);
          } else {
            reject(oReq.statusText);
          }
        };
        oReq.onerror = function () {
          reject("An error occurred during HTTP access");
        };
        oReq.onabort = function () {
          reject("HTTP access is aborted.");
        };
        oReq.timeout = function () {
          reject("HTTP access timed out.");
        };
        oReq.send();
      }
    });
  }
}
