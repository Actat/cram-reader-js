class SeekableArrayBuffer {

    constructor(arrBuf, blobFlag = false) {
        this.arrBuf = arrBuf;
        this.blobFlag = blobFlag;
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
        if(this.blobFlag) {
            return sliced.arrayBuffer();
        } else {
            const promise = new Promise((resolve, reject) => resolve(sliced));
            return promise;
        }
    }

    async readInt8() {
        const view = new DataView(await this.read(1));
        return view.getInt8(0);
    }

    async readInt16() {
        const view = new DataView(await this.read(2));
        return view.getInt16(0, true);
    }

    async readInt32() {
        const view = new DataView(await this.read(4));
        return view.getInt32(0, true);
    }

    async readInt64() {
        const view = new DataView(await this.read(8));
        return view.getBigInt64(0, true);
    }

    async readUint8() {
        const view = new DataView(await this.read(1));
        if (view.byteLength < 1) {
            return 0;
        }
        return view.getUint8(0);
    }

    async readUint16() {
        const view = new DataView(await this.read(2));
        return view.getUint16(0, true);
    }

    async readUint32() {
        const view = new DataView(await this.read(4));
        return view.getUint32(0, true);
    }

    async readUint64() {
        const view = new DataView(await this.read(8));
        return view.getBigUint64(0, true);
    }

    async readBoolean() {
        const view = new DataView(await this.read(1));
        const i =  view.getInt8(0, true);
        return i == 1;
    }

    async readChar() {
        return String.fromCharCode.apply("", new Uint8Array(await this.read(1)));
    }
}
