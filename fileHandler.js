class FileHandler {
  constructor(
    file /* instance of File object or String of URL */,
    localFlag = true
  ) {
    this._file = file;
    this._localFlag = localFlag;
  }

  load(pos = -1, length = -1) {
    return new Promise((resolve, reject) => {
      if (this._localFlag) {
        if (pos >= 0 && length > 0) {
          var sliced = this._file.slice(pos, pos + length);
          resolve(sliced.arrayBuffer());
        } else {
          resolve(this._file.arrayBuffer());
        }
      } else {
        var oReq = new XMLHttpRequest();
        oReq.open("GET", this._file);
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
        oReq.send();
      }
    });
  }
}
