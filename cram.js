class Cram {
    constructor(cramFile, craiFile, localFlag) {
        this.localFlag = localFlag;
        this.cram = new CramFile(cramFile, localFlag, localFlag);
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
        if (!(await this.isCram30File())) {
            console.error("The file is not cram 3.0 file.");
        }

        this.index = await this.loadCraiFile();
        this.chrName = await this.createChrNameList();
        this.cram.seek(6);
        this.fileid = new Uint8Array(await this.cram.read(20));
        // translate from chrName to reference sequence id
        const id = this.chrName.indexOf(chrName);
        // find slices by id, start and end
        const promises = [];
        this.index.forEach((s) => {
            if (s[0] == id && s[1] <= end && s[1] + s[2] >= start) {
                promises.push(new Promise((resolve) => {
                    // find records in the slice
                    const container = new CramContainer(new CramFile(this.cram.arrBuf, this.cram.localFlag, this.cram.blobFlag), s[3]);
                    const cramSlice = new CramSlice(container, s[4]);
                    const records = cramSlice.getRecords();
                    resolve(records);
                }))
            }
        });
        return Promise.all(promises).then((results)=>{
            const reads = [];
            results.forEach((records) => {
                records.forEach((r) => {
                    if (r.refSeqId == id && r.position <= end && r.position + r.readLength >= start) {
                        r.restoreCigar();
                        reads.push(r);
                    }
                });
            })
            return reads;
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
        var craiBuffer;
        if (this.localFlag) {
            craiBuffer = this.crai.arrayBuffer();
        } else {
            craiBuffer = new Promise((resolve, reject) => {
                var oReq = new XMLHttpRequest();
                oReq.open("GET", this.crai);
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
        }
        var index = [];
        var compressed = new Uint8Array(await craiBuffer);
        var plain;
        try {
            var gunzip = new Zlib.Gunzip(compressed);
            plain = gunzip.decompress();
        } catch (error) {
            const e = error.toString();
            if (e.includes("invalid file signature")) {
                plain = compressed;
            } else {
                console.error(e);
            }
        }
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
