class CramSlice {
    //blocks = []
    //container = None
    //coreDataBlock = None
    //offset = 0
    //sliceHeaderBlock = None

    constructor(container, offset) {
        this.container = container
        this.offset = offset
    }

    decodePositions(r) {
        var last_position = NaN;
        if (this.sliceHeaderBlock['content']['refSeqId'] == -2) {
            r.refSeqId = this.readItem('RI', 'Int');
        } else {
            r.refSeqId = this.sliceHeaderBlock['content']['refSeqid'];
        }
        r.readLength = this.readItem('RL', 'Int');
        if (self.container.compressionHeaderBlock['content']['pm']['AP'] != 0) {
            if (isNaN(last_position)) {
                last_position = this.sliceHeaderBlock['content']['alignmentStart'];
            }
            r.position = this.readItem('AP', 'Int') + last_position;
            last_position = r.position;
        } else {
            r.position = this.readItem('AP', 'Int');
        }
        r.readGroup = this.readItem('RG', 'Int');
    }

    decodeNames(r) {
        if (this.container.compressionHeaderBlock['content']['pm']['RN']) {
            var rn = this.readItem('RN', 'ByteArray');
            r.readName = String(rn);
        } else {
            r.readName = this.generateName(r);
        }
    }

    decodeMateData(r) {
        if (r.cf & 2 == 2) {
            // the next fragment is not in the current slice
            const mateFlag = this.readItem('MF', 'Int');
            if (mateFlag & 1 == 1) {
                r.bf = r.bf | 0x20
            }
            if (mateFlag & 2 == 2) {
                r.bf = r.bf | 0x08
            }
            if (this.container.compressionHeaderBlock['content']['pm']['RN'] == false) {
                rn = this.readItem('RN', 'ByteArray');
                r.readName = String(rn);
            }
            r.mateRefId = this.readItem('NS', 'Int');
            r.matePos = this.readItem('NP', 'Int');
            r.templateSize = this.readItem('TS', 'Int');
        } else if (r.cf & 4 == 4) {
            r.nextFrag = this.readItem('NF', 'Int');
        }
    }

    decodeTotalMateData(records) {
        for (var i = 0; i < records.length; i++) {
            var r = records[i];
            if (r.cf & 4 == 4) {
                // mate is downstream
                var n = records[i + r.nextFrag + 1]; // n is next_fragment
                if (n.bf & 0x10 == 0x10) {
                    r.bf = r.bf | 0x20
                }
                if (n.bf & 0x04 == 0x04) {
                    r.bf = r.bf | 0x08
                }
                // read name of mate record
                r.mateReadName = n.readName;
                n.mateReadName = r.readName;
                // Resolve mate_ref_id for this record and this + next_frag onece both have been decoded
                r.mateRefId = n.refSeqId;
                n.mateRefId = r.refSeqId;
                // Resolve mate_position for this record and this + next_frag once both have been decoded
                r.matePos = n.position;
                n.matePos = r.position;
                // Find leftmost and rightmost mapped coordinate in records this and this + next_frag
                if (r.refSeqId != n.refSeqId) {
                    r.templateSize = 0;
                    n.templateSize = 0;
                    return;
                }
                var rmb = r.readLength - (r.hasSoftclip() ? len(r.features['S']) : 0); // mapped bases
                var nmb = n.readLength - (n.hasSoftclip() ? len(n.features['S']) : 0); // mapped bases
                var l = [r.position,
                    r.position + (r.bf & 0x10 != 0x10 ? rmb - 1 : - rmb + 1),
                    n.position,
                    n.position - (n.bf & 0x10 != 0x10 ? nmb - 1 : - nmb + 1)];
                var leftmost = min(l);
                var rightmost = max(l);
                var lm = (l.index(leftmost) < 2 ? r : n);
                var rm = (l.index(rightmost) < 2 ? r : n);
                // For leftmost of this and this + next_frag record: template_size <- rightmost - leftmost + 1
                lm.templateSize = rightmost - leftmost + 1;
                // For rightmost of this and this + next_frag record: template_size <- -(rightmost - leftmost + 1)
                rm.templateSize = -(rightmost - leftmost + 1);
            }
        }
    }

    decodeTagData(r) {
        const tagLine = this.readItem('TL', 'Int');
        var tags = {};
        this.container.compressionHeaderBlock['content']['pm']['TD'][tagLine].forEach(elm => {
            var name = elm.slice(0, 2);
            const tagType = elm.slice(-1);
            var tagValue;
            if (tagType == 'A') {
                tagValue = this.decodeItem(this.container.compressionHeaderBlock['content']['tv'][elm]['valuesEncoding'], 'Char')
            } else if (tagType == 'c' || tagType == 'C' || tagType == 's' || tagType == 'S' || tagType == 'i' || tagType == 'I') {
                tagValue = this.decodeItem(this.container.compressionHeaderBlock['content']['tv'][elm]['valuesEncoding'], 'Int')
            } else if (tagType == 'f') {
                tagValue = this.decodeItem(this.container.compressionHeaderBlock['content']['tv'][elm]['valuesEncoding'], 'float32')
            } else if (tagType == 'Z') {
                tagValue = this.decodeItem(this.container.compressionHeaderBlock['content']['tv'][elm]['valuesEncoding'], 'String')
            } else if (tagType == 'H') {
                tagValue = this.decodeItem(this.container.compressionHeaderBlock['content']['tv'][elm]['valuesEncoding'], 'Hstring')
            } else if (tagType == 'B') {
                tagValue = this.decodeItem(self.container.compressionHeaderBlock['content']['tv'][elm]['valuesEncoding'], 'ByteArray')
            } else {
                console.error("tagType'" + String(tagType) + "' is not supported.");
                continue;
            }
            tags[elm] = tagValue;
        });
        r.tags = tags;
    }

    decodeMappedRead(r) {
        const featureNumber = this.readItem('FN', 'Int');
        if (featureNumber > 0) {
            r.features = new Map();
        }
        for (var i; i < featureNumber; i++) {
            this.decodeFeature(r);
        }
        r.mappingQuality = this.readItem('MQ', 'Int');
        if (this.container.compressionHeaderBlock['content']['dse'].includes('QS')) {
            r.qualityScore = this.readQualityScore(r.readLength);
        }
    }

    decodeFeature(r) {
        const featureCode = String(this.readItem('FC', 'Byte'));
        const featurePosition = this.readItem('FP', 'Int');
        if (featureCode == 'B') {
            r.features['base'] = this.readItem('BA', 'Byte');
            r.features['qualityScore'] = this.readItem('QS', 'Byte');
        } else if (featureCode == 'X') {
            r.features['X'] = this.readItem('BS', 'Byte');
        } else if (featureCode == 'I') {
            r.features['I'] = this.readItem('IN', 'ByteArray');
        } else if (featureCode == 'S') {
            r.features['S'] = this.readItem('SC', 'ByteArray');
        } else if (featureCode == 'H') {
            r.features['H'] = this.readItem('HC', 'Int');
        } else if (featureCode == 'P') {
            r.features['P'] = this.readItem('PD', 'Int');
        } else if (featureCode == 'D') {
            r.features['D'] = this.readItem('DL', 'Int');
        } else if (featureCode == 'N') {
            r.features['N'] = this.readItem('RS', 'Int');
        } else if (featureCode == 'i') {
            r.features['i'] = this.readItem('BA', 'Byte');
        } else if (featureCode == 'b') {
            r.features['b'] = this.readItem('BB', 'ByteArray');
        } else if (featureCode == 'q') {
            r.features['q'] = this.readItem('QQ', 'ByteArray');
        } else if (featureCode == 'Q') {
            r.features['Q'] = this.readItem('QS', 'Byte');
        }
    }

    decodeUnmappedRead(r) {
        b = new Array(r.readLength);
        for (var i = 0; i < r.readLength; i++) {
            b[i] = this.readItem('BA', 'Byte');
        }
        r.base = b;
        if (this.container.compressionHeaderBlock['content']['dse'].includes('QS')) {
            r.qualityScore = this.readQualityScore(r.readLength);
        }
    }

    generateName(r) {
        generatedName = 'generatedName' + String(r.refSeqId) + '.' + String(r.position);
        return generatedName;
    }

    getBlockByExternalId(id) {
        this.getSliceHeaderBlock();
        var index = this.sliceHeaderBlock['content']['blockContentIds'].indexOf(id)
        return this.blocks[index + 1] // +1 for core data block
    }

    getBlocks() {
        if (typeof this.blocks == 'undefined') {
            this.blocks = [];
            this.container.cram.seek(
                this.container.pos
                + this.container.headerLength
                + this.offset
                + this.sliceHeaderBlock['blockSize']);
            for (var i = 0; i < this.sliceHeaderBlock['content']['blockContentIds'].length + 1; i++) {
                // +1 for core data block
                b = this.container.cram.readBlock();
                b['IO'] = new CramFile(b.get('data'))
                this.blocks.push(b)
            }
        }
        return this.blocks;
    }

    /*getCoreDataBlock(self, f) {
        self.getBlocks(f)
        return self.blocks[0]
    }*/

    getRecords() {
        this.container.getCompressionHeaderBlock();
        this.getSliceHeaderBlock();
        this.getBlocks();
        this.blocks[0]['IO'] = new BitsIO(this.blocks[0]['IO']);
        records = [];
        for (var i = 0; i < this.sliceHeaderBlock['content']['numberOfRecords']; i++) {
            bf = self.readItem(f, 'BF', 'Int');
            cf = self.readItem(f, 'CF', 'Int');
            r = new CramRecord(bf, cf);
            this.decodePositions(r);
            this.decodeNames(r);
            this.decodeMateData(r);
            this.decodeTagData(r);
            if ((r.bf & 4) == 0) {
                this.decodeMappedRead(r);
            } else {
                this.decodeUnmappedRead(r);
            }
            records.push(r);
        }
        this.decodeTotalMateData(records);
        return records;
    }

    getSliceHeaderBlock() {
        if (typeof this.sliceHeaderBlock != 'undefined') {
            return this.sliceHeaderBlock;
        }
        b = this.container.cram.readBlock(this.container.pos + this.container.headerLength + this.offset);
        data = new CramFile(b['data']);
        b['content'] = new Map();
        b['content']['refSeqId'] = data.readItf8();
        b['content']['alignmentStart'] = data.readItf8();
        b['content']['alignmentSpan'] = data.readItf8();
        b['content']['numberOfRecords'] = data.readItf8();
        b['content']['recordCounter'] = data.readItf8();
        b['content']['numberOfBlocks'] = data.readItf8();
        b['content']['blockContentIds'] = data.readArrayItf8();
        b['content']['embeddedRefBasesBlockContentId'] = data.readItf8();
        b['content']['refMD5'] = data.read(16);
        //b['content']['optionalTags'] = data.readArrayByte();
        this.sliceHeaderBlock = b;
        return this.sliceHeaderBlock;
    }

    readItem(key, type = 'Byte') {
        return this.decodeItem(this.container.compressionHeaderBlock['content']['dse'][key], type);
    }

    readQualityScore(readLength) {
        var qs = new Array(readLength);
        for (var i = 0; i < readLength; i++) {
            qs[i] = this.readItem('QS', 'Int')
        }
        return String(qs);
    }

    decodeItem(codec, type) {
        const codecId = codec['codecId'];
        var io;
        if (codecId == 1) {
            io = new CramFile(this.getBlockByExternalId(codec['externalId'])['IO']);
            if (type == 'Int') {
                return io.readItf8();
            } else if (type == 'Byte') {
                return io.read(1);
            } else {
                console.error('type ' + type + ' is not supported. (codecId: ' + String(codecId) + ')');
                return;
            }
        } else if (codecId == 3) {
            // HUFFMAN
            const al = codec['alphabet'];
            const bl = codec['bit-length'];
            if (bl == [0]) {
                return al[0];
            } else {
                console.error('HUFFMAN decoding is in the process of being implemented.(cramSlice.decodeItem)');
            }
        } else if (codecId == 5) {
            // BYTE_ARRAY_STOP
            io = new CramFile(this.getBlockByExternalId(codec['externalId'])['IO']);
            var a = [];
            while (true) {
                var c = io.read(1);
                if (c == codec['stopByte']) {
                    return a;
                }
                a.push(c);
            }
        } else if (codecId == 6) {
            // Beta coding
            // Int only
            return this.blocks[0]['IO'].read(codec['length']) - codec['offset'];
        } else {
            console.error('codecId: ' + str(codecId) + ' is not supported. (cramSlice.decodeItem())');
            return;
        }
    }
}
