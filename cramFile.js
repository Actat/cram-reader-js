class CramFile {

    constructor(arrBuf) {
        this.arrBuf = arrBuf;
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
        return sliced;
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

    readItf8() {
        const firstByte = this.readUint8();
        if (firstByte >> 7 == 0b0) {
            return firstByte & 0b01111111;
        } else if (firstByte >> 6 == 0b10) {
            const i = this.readUint8();
            return ((firstByte & 0b00111111) << 8) | i;
        } else if (firstByte >> 5 == 0b110) {
            const i = this.readUint8();
            const j = this.readUint8();
            return ((firstByte & 0b00011111) << 16) | i << 8 | j;
        } else if (firstByte >> 4 == 0b1110) {
            const i = this.readUint8();
            const j = this.readUint8();
            const k = this.readUint8();
            return ((firstByte & 0b00001111) << 24) | i << 16 | j << 8 | k;
        } else {
            const i = this.readUint8();
            const j = this.readUint8();
            const k = this.readUint8();
            const l = this.readUint8();
            const num = ((firstByte & 0b00001111) << 28) | i << 20 | j << 12 | k << 4 | (l & 0b00001111);
            if (num < 2 ** 31) {
                return num
            } else {
                return num - 2 ** 32
            }
        }
    }

    readLtf8() {
        const firstByte = BigInt(this.readUint8());

        if (firstByte >> 7n == 0b0n) {
            return firstByte & 0b01111111n
        } else if (firstByte >> 6n == 0b10n) {
            const i = BigInt(this.readInt8());
            return ((firstByte & 0b00111111n) << 8n) | i;
        } else if (firstByte >> 5n == 0b110n) {
            const i = BigInt(this.readUint8());
            const j = BigInt(this.readUint8());
            return ((firstByte & 0b00011111n) << 16n) | i << 8n | j;
        } else if (firstByte >> 4n == 0b1110n) {
            const i = BigInt(this.readUint8());
            const j = BigInt(this.readUint8());
            const k = BigInt(this.readUint8());
            return ((firstByte & 0b00001111n) << 24n) | i << 16n | j << 8n | k;
        } else if (firstByte >> 3n == 0b11110n) {
            const i = BigInt(this.readUint8());
            const j = BigInt(this.readUint8());
            const k = BigInt(this.readUint8());
            const l = BigInt(this.readUint8());
            return ((firstByte & 0b00000111n) << 32n) | i << 24n | j << 16n | k << 8n | l;
        } else if (firstByte >> 2n == 0b111110n) {
            const i = BigInt(this.readUint8());
            const j = BigInt(this.readUint8());
            const k = BigInt(this.readUint8());
            const l = BigInt(this.readUint8());
            const m = BigInt(this.readUint8());
            return ((firstByte & 0b00000011n) << 40n) | i << 32n | j << 24n | k << 16n | l << 8n| m;
        } else if (firstByte >> 1n == 0b1111110n) {
            const i = BigInt(this.readUint8());
            const j = BigInt(this.readUint8());
            const k = BigInt(this.readUint8());
            const l = BigInt(this.readUint8());
            const m = BigInt(this.readUint8());
            const n = BigInt(this.readUint8());
            return ((firstByte & 0b00000001n) << 48n) | i << 40n | j << 32n | k << 24n | l << 16n | m << 8n | n;
        } else if (firstByte == 0b11111110n) {
            const i = BigInt(this.readUint8());
            const j = BigInt(this.readUint8());
            const k = BigInt(this.readUint8());
            const l = BigInt(this.readUint8());
            const m = BigInt(this.readUint8());
            const n = BigInt(this.readUint8());
            const o = BigInt(this.readUint8());
            return i << 48n | j << 40n | k << 32n | l << 24n | m << 16n | n << 8n | o;
        } else {
            return this.readInt64();
        }
    }

    readArrayItf8() {
        var result = [];
        const length = this.readItf8();
        for (var i = 0; i < length; i++) {
            result.push(this.readItf8());
        }
        return result;
    }

    readArrayByte() {
        const length = this.readItf8();
        return this.read(length);
    }

    readEncodingInt() {
        var result = new Map();
        result.set('codecId', this.readItf8());
        const numberOfBytesToFollow = this.readItf8();
        if (result.get('codecId') == 1) {
            // EXTERNAL: codec ID 1
            result.set('externalId', this.readItf8());
            return result;
        } else if (result.get('codecId') == 3) {
            // Huffman coding: codec ID 3
            result.set('alphabet', this.readArrayItf8());
            result.set('bit-length', this.readArrayItf8());
            return result;
        } else if (result.get('codecId') == 6) {
            // Beta coding: codec ID 6
            result.set('offset', this.readItf8());
            result.set('length', this.readItf8());
            return result;
        } else if (result.get('codecId') == 7) {
            // Subexponential coding: codec ID 7
            result.set('offset', this.readItf8());
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

    readEncodingByte() {
        var result = new Map();
        result.set('codecId', this.readItf8());
        const numberOfBytesToFollow = this.readItf8();

        if (result.get('codecId') == 1) {
            // EXTERNAL: codec ID 1
            result.set('externalId', this.readItf8());
            return result;
        } else if (result.get('codecId') == 3) {
            // Huffman coding: codec ID 3
            result.set('alphabet', this.readArrayItf8());
            result.set('bit-length', this.readArrayItf8());
            return result;
        } else {
            console.log('Error: invalid codec ID');
            return result;
        }
    }

    readEncodingByteArray() {
        var result = new Map();
        result.set('codecId', this.readItf8());
        const numberOfBytesToFollow = this.readItf8();
        if (result.get('codecId') == 4) {
            // BYTE_ARRAY_LEN: codec ID 4
            result.set('lengthsEncoding', this.readEncodingInt());
            result.set('valuesEncoding', this.readEncodingByte());
            return result;
        } else if (result.get('codecId') == 5) {
            // BYTE_ARRAY_STOP: codec ID 5
            result.set('stopByte', this.read(1));
            result.set('externalId', this.readItf8());
            return result;
        } else {
            console.log('Error: invalid codec ID')
            return result;
        }
    }

    readBlock(pos = -1) {
        var result = new Map();
        if (pos >= 0) {
            this.seek(pos);
        }
        const p = this.tell();
        result.set("method", this.readInt8());
        result.set("contentTypeId", this.readInt8());
        result.set("contentId", this.readItf8());
        result.set("size", this.readItf8());
        result.set("rawSize", this.readItf8());
        const data = this.read(result.get("size"));
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
            result.set("data", cr.ransDecode());
        }
        result.set('CRC32', this.readUint32());
        result.set('blockSize', this.tell() - p);
        if (result.has('data')) {
            result.set("IO", new CramFile(result.get('data')));
        }
        return result
    }
}
