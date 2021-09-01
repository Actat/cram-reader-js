class Cram {
    constructor(cramBuffer, craiBuffer) {
        this.cram = new CramFile(cramBuffer);
        if (this.isCram30File()) {
            this.crai = craiBuffer;
            this.loadCraiFile();
            this.cram.seek(6);
            this.fileid = new Uint8Array(this.cram.read(20));
        } else {
            console.error("Passed file is not a cram 3.0 file.");
        }
    }

    createChrNameList() {
        if (typeof this.chrName !== 'undefined') {
            return;
        }
        this.getSamHeader();
        this.samHeader.forEach((l) => {
            if (l[0] == '@SQ') {
                this.chrName.push(l[1]['SN']);
            }
        });
    }

    getRecords(chrName, start, end) {
        var result = [];
        // translate from chrName to reference sequence id
        if (typeof this.chrName === 'undefined') {
            this.createChrNameList();
        }
        const id = this.chrName.indexOf(chrName);
        // find slices by id, start and end
        this.index.forEach((s) => {
            if (s[0] == id && s[1] <= end && s[1] + s[2] >= start) {
                // find records in the slice
                const container = new CramContainer(this.cram, s[3]);
                const cramSlice = new CramSlice(container, s[4]);
                const records = cramSlice.getRecords();
                records.forEach((r) => {
                    if (r.refSeqId == id && r.position <= end && r.position + r.readLength >= start) {
                        result.push(r);
                    }
                });
            }
        });
        return result;
    }

    getSamHeader() {
        if (typeof this.samHeader !== 'undefined') {
            return;
        }
        c = new CramContainer(this.cram, 26);
        b = this.cram.readBlock(this.cram, c.pos + c.headerLength);
        t = String.fromCharCode.apply("", new Uint16Array(b["data"]));
        this.samHeader = parseSamHeader(t);
    }

    isCram30File() {
        this.cram.seek(0);
        var buf = this.cram.read(4);
        var head = String.fromCharCode.apply("", new Uint8Array(buf));
        var version = new Uint8Array(this.cram.read(2));
        return head === 'CRAM' && version[0] == 3 && version[1] == 0;
    }

    loadCraiFile() {
        if (typeof self.index !== 'undefined') {
            return;
        }
        self.index = [];
        var compressed = new Uint8Array(self.crai);
        var gunzip = new Zlib.Gunzip(compressed);
        const plain = gunzip.decompress();
        const lines = plain.split('\n');
        lines.forEach((line) => {
            const l = line.split('\t');
            if (l.length == 6) {
                self.index.push([
                    parseInt(l[0], 10),
                    parseInt(l[1], 10),
                    parseInt(l[2], 10),
                    parseInt(l[3], 10),
                    parseInt(l[4], 10),
                    parseInt(l[5], 10)]);
            }
        });
    }

    parseSamHeader(txt) {
        var result = [];
        const lines = txt.split('\n');
        lines.forEach((line) => {
            const l = line.split('\t');
            var d = new Map();
            for (var i = 1; i < l.length; i++) {
                const s = l[i].split(':');
                d[s[0]] = s[1];
            }
            result.push([l[0], d]);
        });
        return result
    }
}