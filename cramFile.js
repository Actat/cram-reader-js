class CramFile {

    constructor(arrBuf, localFlag = true, blobFlag = false) {
        this.arrBuf = arrBuf;
        this.localFlag = localFlag;
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
        if (this.localFlag) {
            const sliced = this.arrBuf.slice(this.index, this.index + i);
            this.index += i;
            if (this.blobFlag) {
                return sliced.arrayBuffer();
            } else {
                const promise = new Promise((resolve, reject) => resolve(sliced));
                return promise;
            }
        } else {
            const promise = new Promise((resolve, reject) => {
                var oReq = new XMLHttpRequest();
                oReq.open("GET", this.arrBuf);
                oReq.setRequestHeader("Range", "bytes=" + this.index + "-" + (this.index + i - 1));
                oReq.responseType = "arraybuffer";
                oReq.onload = function (oEvent) {
                    const ab = oReq.response;
                    if (ab) {
                        resolve(ab);
                    } else {
                        reject(oReq.statusText);
                    }
                }
                oReq.send();
            });
            this.index += i;
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

    async readItf8() {
        const firstByte = await this.readUint8();
        if (firstByte >> 7 == 0b0) {
            return firstByte & 0b01111111;
        } else if (firstByte >> 6 == 0b10) {
            const i = await this.readUint8();
            return ((firstByte & 0b00111111) << 8) | i;
        } else if (firstByte >> 5 == 0b110) {
            const i = await this.readUint8();
            const j = await this.readUint8();
            return ((firstByte & 0b00011111) << 16) | i << 8 | j;
        } else if (firstByte >> 4 == 0b1110) {
            const i = await this.readUint8();
            const j = await this.readUint8();
            const k = await this.readUint8();
            return ((firstByte & 0b00001111) << 24) | i << 16 | j << 8 | k;
        } else {
            const i = await this.readUint8();
            const j = await this.readUint8();
            const k = await this.readUint8();
            const l = await this.readUint8();
            const num = ((firstByte & 0b00001111) << 28) | i << 20 | j << 12 | k << 4 | (l & 0b00001111);
            if (num < 2 ** 31) {
                return num
            } else {
                return num - 2 ** 32
            }
        }
    }

    async readLtf8() {
        const firstByte = BigInt(await this.readUint8());

        if (firstByte >> 7n == 0b0n) {
            return firstByte & 0b01111111n
        } else if (firstByte >> 6n == 0b10n) {
            const i = BigInt(await this.readInt8());
            return ((firstByte & 0b00111111n) << 8n) | i;
        } else if (firstByte >> 5n == 0b110n) {
            const i = BigInt(await this.readUint8());
            const j = BigInt(await this.readUint8());
            return ((firstByte & 0b00011111n) << 16n) | i << 8n | j;
        } else if (firstByte >> 4n == 0b1110n) {
            const i = BigInt(await this.readUint8());
            const j = BigInt(await this.readUint8());
            const k = BigInt(await this.readUint8());
            return ((firstByte & 0b00001111n) << 24n) | i << 16n | j << 8n | k;
        } else if (firstByte >> 3n == 0b11110n) {
            const i = BigInt(await this.readUint8());
            const j = BigInt(await this.readUint8());
            const k = BigInt(await this.readUint8());
            const l = BigInt(await this.readUint8());
            return ((firstByte & 0b00000111n) << 32n) | i << 24n | j << 16n | k << 8n | l;
        } else if (firstByte >> 2n == 0b111110n) {
            const i = BigInt(await this.readUint8());
            const j = BigInt(await this.readUint8());
            const k = BigInt(await this.readUint8());
            const l = BigInt(await this.readUint8());
            const m = BigInt(await this.readUint8());
            return ((firstByte & 0b00000011n) << 40n) | i << 32n | j << 24n | k << 16n | l << 8n| m;
        } else if (firstByte >> 1n == 0b1111110n) {
            const i = BigInt(await this.readUint8());
            const j = BigInt(await this.readUint8());
            const k = BigInt(await this.readUint8());
            const l = BigInt(await this.readUint8());
            const m = BigInt(await this.readUint8());
            const n = BigInt(await this.readUint8());
            return ((firstByte & 0b00000001n) << 48n) | i << 40n | j << 32n | k << 24n | l << 16n | m << 8n | n;
        } else if (firstByte == 0b11111110n) {
            const i = BigInt(await this.readUint8());
            const j = BigInt(await this.readUint8());
            const k = BigInt(await this.readUint8());
            const l = BigInt(await this.readUint8());
            const m = BigInt(await this.readUint8());
            const n = BigInt(await this.readUint8());
            const o = BigInt(await this.readUint8());
            return i << 48n | j << 40n | k << 32n | l << 24n | m << 16n | n << 8n | o;
        } else {
            return await this.readInt64();
        }
    }

    async readArrayItf8() {
        var result = [];
        const length = await this.readItf8();
        for (var i = 0; i < length; i++) {
            result.push(await this.readItf8());
        }
        return result;
    }

    async readArrayByte() {
        const length = await this.readItf8();
        return await this.read(length);
    }

    async readEncodingInt() {
        var result = new Map();
        result.set('codecId', await this.readItf8());
        const numberOfBytesToFollow = await this.readItf8();
        if (result.get('codecId') == 1) {
            // EXTERNAL: codec ID 1
            result.set('externalId', await this.readItf8());
            return result;
        } else if (result.get('codecId') == 3) {
            // Huffman coding: codec ID 3
            result.set('alphabet', await this.readArrayItf8());
            result.set('bit-length', await this.readArrayItf8());
            return result;
        } else if (result.get('codecId') == 6) {
            // Beta coding: codec ID 6
            result.set('offset', await this.readItf8());
            result.set('length', await this.readItf8());
            return result;
        } else if (result.get('codecId') == 7) {
            // Subexponential coding: codec ID 7
            result.set('offset', await this.readItf8());
            result.set('k', readItf8());
            return result;
        } else if (result.get('codecId') == 9) {
            // Gamma coding: codec ID 9
            result.set('offset', readItf8());
            return result;
        } else {
            console.log('Error: invalid codec ID');
            return result;
        }
    }

    async readEncodingByte() {
        var result = new Map();
        result.set('codecId', await this.readItf8());
        const numberOfBytesToFollow = await this.readItf8();

        if (result.get('codecId') == 1) {
            // EXTERNAL: codec ID 1
            result.set('externalId', await this.readItf8());
            return result;
        } else if (result.get('codecId') == 3) {
            // Huffman coding: codec ID 3
            result.set('alphabet', await this.readArrayItf8());
            result.set('bit-length', await this.readArrayItf8());
            return result;
        } else {
            console.log('Error: invalid codec ID');
            return result;
        }
    }

    async readEncodingByteArray() {
        var result = new Map();
        result.set('codecId', await this.readItf8());
        const numberOfBytesToFollow = await this.readItf8();
        if (result.get('codecId') == 4) {
            // BYTE_ARRAY_LEN: codec ID 4
            result.set('lengthsEncoding', await this.readEncodingInt());
            result.set('valuesEncoding', await this.readEncodingByte());
            return result;
        } else if (result.get('codecId') == 5) {
            // BYTE_ARRAY_STOP: codec ID 5
            result.set('stopByte', await this.read(1));
            result.set('externalId', await this.readItf8());
            return result;
        } else {
            console.log('Error: invalid codec ID')
            return result;
        }
    }

    async readBlock(pos = -1) {
        var result = new Map();
        if (pos >= 0) {
            this.seek(pos);
        }
        const p = this.tell();
        result.set("method", await this.readInt8());
        result.set("contentTypeId", await this.readInt8());
        result.set("contentId", await this.readItf8());
        result.set("size", await this.readItf8());
        result.set("rawSize", await this.readItf8());
        const data = await this.read(result.get("size"));
        if (result.get("method") == 0) {
            // raw
            result.set("data", data);
        } else if (result.get("method") == 1) {
            // gzip
            var compressed = new Uint8Array(data);
            var gunzip = new Zlib.Gunzip(compressed);
            var plain = gunzip.decompress();
            result.set("data", plain.buffer);
        } else if (result.get("method") == 2) {
            // bzip2
            console.log("bzip2 is not supported (contentTypeId: " + str(result.get("contentTypeId")) + ", contentId: " + str(result.get("contentId")) + ")");
            //result["data"] = data
        } else if (result.get("method") == 3) {
            // lzma
            console.log("lzma is not supported (contentTypeId: " + str(result.get("contentTypeId")) + ", contentId: " + str(result.get("contentId")) + ")");
            //result["data"] = data
        } else if (result.get("method") == 4) {
            // rans
            var cr = new CramRans(data);
            result.set("data", await cr.ransDecode());
        }
        result.set('CRC32', await this.readUint32());
        result.set('blockSize', this.tell() - p);
        if (result.has('data')) {
            result.set("IO", new CramFile(result.get('data'), true, false));
        }
        return result
    }
}
