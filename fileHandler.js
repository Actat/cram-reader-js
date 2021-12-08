class FileHandler {
    constructor(
        file /* instance of File object or String of URL */,
        localFlag = true
    ) {
        this._file = file;
        this._localFlag = localFlag;
    }

    load(pos, length) {
        return new Promise((resolve, reject) => {
            if (this._localFlag) {
                var sliced = this._file.slice(pos, pos + length);
                resolve(sliced.arrayBuffer());
            } else {
                var oReq = new XMLHttpRequest();
                oReq.open("GET", this._file);
                oReq.setRequestHeader(
                    "Range",
                    "bytes=" + pos + "-" + (pos + length - 1)
                );
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
