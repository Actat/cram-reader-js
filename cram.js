class Cram {
  constructor(cram, crai, local_flag) {
    this.local_flag_ = local_flag;
    this.cram_ = new FileHandler(cram, local_flag);
    this.crai_ = new FileHandler(crai, local_flag);
  }

  getRecords(chr, start, end) {
    return Promise.all([this.loadCraiFile(), this.loadCramHeader()])
      .then((values) => {
        var index = values[0];
        var chrNameList = values[1];
        var recordLists = [];
        // find slices which match with chr name, start and end
        var id = chrNameList.indexOf(chr);
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
                    read.refSeqName = chrNameList[read.refSeqId];
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
    return this.crai_.load().then((crai) => {
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
    var checked_stream = this.cram_
      .load(0, 26 + 23)
      .then((arrBuf) => {
        return new CramStream(arrBuf);
      })
      .then((stream) => {
        // process file definition
        // check file signature
        var head = stream.readString(4);
        var version = new Uint8Array(stream.read(2));
        if (head !== "CRAM" || version[0] !== 3 || version[1] !== 0) {
          throw "[invalid file signature] This file is not CRAM 3.0 file.";
        }
        // read file id
        this.fileid_ = stream.readString(20);
        return stream;
      });
    var container = checked_stream.then((stream) => {
      // read container
      var container = new CramContainer(stream, 26);
      container.readHeader();
      return container;
    });
    var additional_buffer = container.then((container) => {
      return this.cram_.load(
        26 + 23,
        container.getHeaderLength() + container.landmarks[1] - 23
      );
    });
    return Promise.all([checked_stream, container, additional_buffer]).then(
      (values) => {
        var stream = values[0];
        var container = values[1];
        var ab = values[2];
        stream.concat(ab);
        var block = stream.readBlock(
          container.getPosition() + container.getHeaderLength()
        );
        var txt = String.fromCharCode.apply(
          "",
          new Uint8Array(block.get("data"))
        );
        var list = [];
        txt.split("\n").forEach((line) => {
          var words = line.split("\t");
          if (words[0] == "@SQ") {
            list.push(words[words.indexOf("SN") + 1]);
          }
        });
        return list;
      }
    );
  }
}
