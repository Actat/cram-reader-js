class Cram {
    constructor(cramFile, craiFile, localFlag) {
        this.localFlag = localFlag;
        this.cram = new CramFile(cramFile, localFlag);
        this.crai = craiFile;
    }

    async createChrNameList() {
        if (typeof this.chrName !== 'undefined') {
            return this.chrName;
        }
        this.samHeader = await this.getSamHeader();
        var chrName = [];
        this.samHeader.forEach((l) => {
            if (l[0] == '@SQ') {
                chrName.push(l[1].get('SN'));
            }
        });
        return chrName;
    }

    async getRecords(chrName, start, end) {
        return new Promise(async (resolve, reject) => {
            if (this.isCram30File()) {
                this.index = await this.loadCraiFile();
                this.chrName = await this.createChrNameList();
                this.cram.seek(6);
                this.fileid = new Uint8Array(await this.cram.read(20));
                var result = [];
                // translate from chrName to reference sequence id
                const id = this.chrName.indexOf(chrName);
                // find slices by id, start and end
                this.index.forEach((s) => {
                    if (s[0] == id && s[1] <= end && s[1] + s[2] >= start) {
                        // find records in the slice
                        const container = new CramContainer(this.cram, s[3]);
                        await container.readHeader();
                        const cramSlice = new CramSlice(container, s[4]);
                        const records = cramSlice.getRecords();
                        records.forEach((r) => {
                            if (r.refSeqId == id && r.position <= end && r.position + r.readLength >= start) {
                                r.restoreCigar();
                                result.push(r);
                            }
                        });
                    }
                });
                resolve(result);
            } else {
                reject("The file is not cram 3.0 file.");
            }
        });
    }

    async getSamHeader() {
        if (typeof this.samHeader !== 'undefined') {
            return;
        }
        var c = new CramContainer(this.cram, 26);
        await c.readHeader();
        var b = await this.cram.readBlock(c.pos + c.headerLength);
        var t = String.fromCharCode.apply("", new Uint8Array(b.get("data")));
        return this.parseSamHeader(t);
    }

    async isCram30File() {
        this.cram.seek(0);
        var buf = await this.cram.read(4);
        var head = String.fromCharCode.apply("", new Uint8Array(buf));
        buf = await this.cram.read(2);
        var version = new Uint8Array(buf);
        return head === 'CRAM' && version[0] == 3 && version[1] == 0;
    }

    async loadCraiFile() {
        if (typeof this.index !== 'undefined') {
            return this.index;
        }
        const craiBuffer = await this.crai.arrayBuffer();
        var index = [];
        var compressed = new Uint8Array(craiBuffer);
        var gunzip = new Zlib.Gunzip(compressed);
        const plain = gunzip.decompress();
        const plaintext = String.fromCharCode.apply("", plain);
        const lines = plaintext.split('\n');
        lines.forEach((line) => {
            const l = line.split('\t');
            if (l.length == 6) {
                index.push([
                    parseInt(l[0], 10),
                    parseInt(l[1], 10),
                    parseInt(l[2], 10),
                    parseInt(l[3], 10),
                    parseInt(l[4], 10),
                    parseInt(l[5], 10)]);
            }
        });
        return index;
    }

    parseSamHeader(txt) {
        var result = [];
        const lines = txt.split('\n');
        lines.forEach((line) => {
            const l = line.split('\t');
            var d = new Map();
            for (var i = 1; i < l.length; i++) {
                const s = l[i].split(':');
                d.set(s[0], s[1]);
            }
            result.push([l[0], d]);
        });
        return result
    }
}
