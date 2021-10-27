class CramContainer {
    constructor(cram, pos) {
        this.cram = cram;
        this.pos = pos;
        this.readHeader();
    }

    decodeTagDictionary(arrBuf){
        var data = new Int8Array(arrBuf);
        var d = [];
        var i = 0;
        while (i + 2 < arrBuf.byteLength) {
            var tmp = []
            while (data[i] != '\0'.charCodeAt(0)) {
                var tagId = String.fromCharCode(data[i], data[i + 1]);
                var tagType = String.fromCharCode(data[i + 2]);
                tmp.push(tagId + tagType)
                i += 3
            }
            d.push(tmp)
            i += 1
        }
        return d
    }

    getCompressionHeaderBlock() {
        if (typeof this.compressionHeaderBlock !== 'undefined') {
            return this.compressionHeaderBlock;
        }
        var b = this.cram.readBlock(this.pos + this.headerLength);
        var chb = new Map();
        const data = new CramFile(b.get('data'));
        // preservation map
        {
            chb.set('pm', new Map());
            chb.get('pm').set('RN', true);
            chb.get('pm').set('AP', true);
            chb.get('pm').set('RR', true);
            const size = data.readItf8();
            const number = data.readItf8();
            for (var i = 0; i < number; i++) {
                const k = String.fromCharCode.apply("", new Uint8Array(data.read(2)));
                var v;
                if (k == 'RN' || k == 'AP' || k == 'RR') {
                    v = data.readBoolean();
                } else if (k == 'SM') {
                    v = data.read(5);
                } else if (k == 'TD') {
                    v = this.decodeTagDictionary(data.readArrayByte());
                } else {
                    continue;
                }
                chb.get('pm').set(k, v);
            }
        }
        // data series encodings
        {
            chb.set('dse', new Map());
            const size = data.readItf8();
            const number = data.readItf8();
            for (var i = 0; i < number; i++) {
                const k = String.fromCharCode.apply("", new Uint8Array(data.read(2)));
                var v;
                if (['BF', 'CF', 'RI', 'RL', 'AP', 'RG', 'MF', 'NS', 'NP', 'TS'
                    , 'NF', 'TL', 'FN', 'FP', 'DL', 'RS', 'PD', 'HC', 'MQ'].includes(k)) {
                    v = data.readEncodingInt();
                } else if (['RN', 'BB', 'QQ', 'IN', 'SC'].includes(k)) {
                    v = data.readEncodingByteArray();
                } else if (['FC', 'BS', 'BA', 'QS'].includes(k)) {
                    v = data.readEncodingByte();
                } else{
                    continue;
                }
                chb.get('dse').set(k, v);
            }
        }
        // tag encoding map
        {
            chb.set('tv', new Map());
            const size = data.readItf8();
            const number = data.readItf8();
            for (var i = 0; i < number; i++) {
                const k = data.readItf8();
                const key = String.fromCharCode((k & 0xff0000) >> 16, (k & 0xff00) >> 8, k & 0xff);
                const v = data.readEncodingByteArray();
                chb.get('tv').set(key, v);
            }
        }
        b.set('content', chb);
        this.compressionHeaderBlock = b;
        return this.compressionHeaderBlock;
    }

    readHeader() {
        this.cram.seek(this.pos);
        this.length = this.cram.readInt32();
        this.refSeqId = this.cram.readItf8();
        this.startingRefPos = this.cram.readItf8();
        this.alignmentSpan = this.cram.readItf8();
        this.numberOfRecords = this.cram.readItf8();
        this.recordCounter = this.cram.readLtf8();
        this.bases = this.cram.readLtf8();
        this.numberOfBlocks = this.cram.readItf8();
        this.landmarks = this.cram.readArrayItf8();
        this.crc32 = this.cram.readUint32();
        this.headerLength = this.cram.tell() - this.pos;
    }
}
