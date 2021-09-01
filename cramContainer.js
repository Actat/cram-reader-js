class CramContainer {
    constructor(cram, pos) {
        this.cram = cram;
        this.pos = pos;
        this.readHeader()
    }

    decodeTagDictionary(arrBuf){
        var data = new Int8Array(arrBuf);
        var d = [];
        var i = 0;
        while (i + 2 < arrBuf.byteLength) {
            tmp = []
            while (data[i] != '\0'.charCodeAt(0)) {
                tagId = String.fromCharCode(data[i], data[i + 1]);
                tagType = String.fromCharCode(data[i + 2]);
                tmp.append(tagId + tagType)
                i += 3
            }
            d.append(tmp)
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
        const data = new CramFile(b['data'])
        // preservation map
        {
            chb['pm'] = {'RN': True, 'AP': True, 'RR': True};
            const size = data.readItf8();
            const number = data.readItf8();
            for (var i = 0; i < number; i++) {
                const k = String.fromCharCode.apply("", new Uint16Array(data.read(2)));
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
                chb['pm'][k] = v;
            }
        }
        // data series encodings
        {
            chb['dse'] = new Map();
            const size = data.readItf8();
            const number = data.readItf8();
            for (var i = 0; i < number; i++) {
                const k = String.fromCharCode.apply("", new Uint16Array(data.read(2)));
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
                chb['dse'][k] = v;
            }
        }
        // tag encoding map
        {
            chb['tv'] = new Map();
            const size = data.readItf8();
            const number = data.readItf8();
            for (var i = 0; i < number; i++) {
                const k = data.readItf8();
                const key = String.fromCharCode((k & 0xff0000) >> 16, (k & 0xff00) >> 8, k & 0xff);
                const v = data.readEncodingByteArray();
                chb['tv'][key] = v;
            }
            b['content'] = chb;
            self.compressionHeaderBlock = b;
            return self.compressionHeaderBlock;
        }
    }

    /*
    isEOFcontainer(self) {
        return (self.length == 15
            and self.refSeqId == -1
            and self.startingRefPos == 4542278
            and self.alignmentSpan == 0
            and self.numberOfRecords == 0
            and self.recordCounter == 0
            and self.bases == 0
            and self.numberOfBlocks == 1
            and self.crc32 == 1339669765)
    }
    */

    /*
    nextPos(self) {
        return self.pos + self.headerLength + self.length
    }
    */

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
