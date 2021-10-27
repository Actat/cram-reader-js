class SeekableArrayBuffer {

    constructor(arrBuf, localFlag) {
        // When localFlag is True, arrBuf is File (Web API) or blob.
        this.arrBuf = arrBuf;
        this.localFlag = localFlag;
        this.index = 0;
    }

    tell() {
        return this.index;
    }

    seek(i) {
        this.index = i;
    }

    read(i) {
        const sliced = this.arrBuf.slice(this.index, this.index + i);
        this.index += i;
        if(this.localFlag) {
            return sliced.arrayBuffer();
        } else {
            const promise = new Promise((resolve, reject) => resolve(sliced));
        }
    }

    readInt8() {
        const view = new DataView(this.read(1));
        return view.getInt8(0);
    }

    readInt16() {
        const view = new DataView(this.read(2));
        return view.getInt16(0, true);
    }

    readInt32() {
        const view = new DataView(this.read(4));
        return view.getInt32(0, true);
    }

    readInt64() {
        const view = new DataView(this.read(8));
        return view.getBigInt64(0, true);
    }

    readUint8() {
        const view = new DataView(this.read(1));
        if (view.byteLength < 1) {
            return 0;
        }
        return view.getUint8(0);
    }

    readUint16() {
        const view = new DataView(this.read(2));
        return view.getUint16(0, true);
    }

    readUint32() {
        const view = new DataView(this.read(4));
        return view.getUint32(0, true);
    }

    readUint64() {
        const view = new DataView(this.read(8));
        return view.getBigUint64(0, true);
    }

    readBoolean() {
        const view = new DataView(this.read(1));
        const i =  view.getInt8(0, true);
        return i == 1;
    }

    readChar() {
        return String.fromCharCode.apply("", new Uint8Array(this.read(1)));
    }
}
