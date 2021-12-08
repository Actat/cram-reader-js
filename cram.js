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
                                            chrNameList[read.refSeqId];
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

    loadCramHeader() {
        return this._cram.load(0, 26 + 23).then((arrBuf) => {
            // check file signature
            var stream = new CramStream(arrBuf);
            var head = String.fromCharCode.apply(
                "",
                new Uint8Array(stream.read(4))
            );
            var version = new Uint8Array(stream.read(2));
            if (head !== "CRAM" || version[0] !== 3 || version[1] !== 0) {
                throw "[invalid file signature] This file is not CRAM 3.0 file.";
            }

            // file id
            this._fileid = String.fromCharCode.apply(
                "",
                new Uint8Array(stream.read(20))
            );

            // read container
            var container = new CramContainer(stream, 26);
            container.readHeader();
            var block = stream.readBlock(
                container.getPosition() + container.getHeaderLength()
            );
            var txt = String.fromCharCode.apply(
                "",
                new Uint8Array(block.get("data"))
            );
            //var parsed = this.parseSamHeader(txt);
            var chrNameList = [];
            txt.split("\n").forEach((line) => {
                var words = line.split("\t");
                if (words[0] == "@SQ") {
                    chrName.push(words[words.indexOf("SN") + 1]);
                }
            });
            return chrNameList;
        });
    }
}
