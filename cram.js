class Cram {
    constructor(cramFile, craiFile, localFlag) {
        this._localFlag = localFlag;
        this._cram = new FileHandler(cramFile, localFlag);
        this._crai = new FileHandler(craiFile, localFlag);
    }

    getRecords(chrName, start, end) {
        return Promise.all([this.loadCraiFile(), this.loadCramHeader()])
            .then(([index, chrNameList]) => {
                var recordLists = [];
                // find slices which match with chr name, start and end
                var id = chrNameList.indexOf(chrName);
                index.forEach((s) => {
                    if (s[0] == id && s[1] <= end && s[1] + s[2] >= start) {
                        // load records in the slice
                        var recordsInSlice = this.loadContainer(s[3])
                            .then((container) => {
                                return this.loadSlice(s, container);
                            })
                            .then((slice) => {
                                return slice.getRecords();
                            })
                            .then((records) => {
                                // find reads match with id (chr name), start and end
                                var reads = [];
                                records.forEach((read) => {
                                    if (
                                        read.refSeqId == id &&
                                        read.position <= end &&
                                        read.position + r.readLength >= start
                                    ) {
                                        read.refSeqName =
                                            this.chrName[read.refSeqId];
                                        read.restoreCigar();
                                        reads.push(read);
                                    }
                                });
                                return reads;
                            });
                        recordLists.push(recordsInSlice);
                    }
                });
                return recordLists;
            })
            .then((recordLists) => {
                Promise.all(recordLists).then((lists) => {
                    // concat all record lists
                    var result = [];
                    lists.forEach((list) => {
                        result.concat(list);
                    });
                    return result;
                });
            });
    }

    async createChrNameList() {
        if (typeof this.chrName !== "undefined") {
            return this.chrName;
        }
        this.samHeader = await this.getSamHeader();
        var chrName = [];
        this.samHeader.forEach((l) => {
            if (l[0] == "@SQ") {
                chrName.push(l[1].get("SN"));
            }
        });
        return chrName;
    }

    async getSamHeader() {
        if (typeof this.samHeader !== "undefined") {
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
        return head === "CRAM" && version[0] == 3 && version[1] == 0;
    }

    loadCraiFile() {
        return this._crai.load().then((crai) => {
            var index = [];
            var compressed = new Uint8Array(crai);
            var plain;
            try {
                var gunzip = new Zlib.Gunzip(compressed);
                plain = gunzip.decompress();
            } catch (error) {
                if (error.toString().includes("invalid file signature")) {
                    // For browsers that automatically extract zips
                    plain = compressed;
                } else {
                    console.error(error);
                }
            }
            var plaintext = String.fromCharCode.apply("", plain);
            var lines = plaintext.split("\n");
            lines.forEach((line) => {
                var l = line.split("\t");
                if (l.length == 6) {
                    index.push([
                        parseInt(l[0], 10),
                        parseInt(l[1], 10),
                        parseInt(l[2], 10),
                        parseInt(l[3], 10),
                        parseInt(l[4], 10),
                        parseInt(l[5], 10),
                    ]);
                }
            });
            return index;
        });
    }

    parseSamHeader(txt) {
        var result = [];
        const lines = txt.split("\n");
        lines.forEach((line) => {
            const l = line.split("\t");
            var d = new Map();
            for (var i = 1; i < l.length; i++) {
                const s = l[i].split(":");
                d.set(s[0], s[1]);
            }
            result.push([l[0], d]);
        });
        return result;
    }
}
