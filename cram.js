class Cram {
  constructor(cram, crai, local_flag) {
    if (!cram || !crai) {
      throw "Files are Falsy";
    }
    this.local_flag_ = local_flag;
    this.cram_ = new FileHandler(cram, local_flag);
    this.crai_ = new FileHandler(crai, local_flag);
    this.containers_ = new Map();
  }

  getRecords(chr, start, end) {
    return new Promise((resolve, reject) => {
      var index = this.loadCraiFile_();
      var chr_list_promise = this.loadCramHeader_();
      var chr_list;
      var id = chr_list_promise
        .then((cl) => {
          chr_list = cl;
          return cl.indexOf(chr);
        })
        .catch((e) => {
          reject(e);
        });
      var record_lists = [];
      var promise_list = Promise.all([index, id])
        .then((values) => {
          var index = values[0];
          var id = values[1];
          var promises = [];

          // find slices which match with chr name, start and end
          index.forEach((s) => {
            if (s[0] == id && s[1] <= end && s[1] + s[2] >= start) {
              var all_records = this.loadAllRecordsInSlice_(s);
              var records_have_pushed = all_records.then((records) => {
                var filtered = this.filterRecord_(id, start, end, records);
                record_lists.push(filtered);
              });
              promises.push(records_have_pushed);
            }
          });
          return promises;
        })
        .catch((e) => {
          reject(e);
        });
      promise_list
        .then((promises) => {
          Promise.all(promises).then(() => {
            // concat all record lists
            var filtered_records = [];
            record_lists.forEach((list) => {
              filtered_records = filtered_records.concat(list);
            });
            // decorate all records
            filtered_records.forEach((record) => {
              this.decorateRecords_(chr_list, record);
            });
            resolve(filtered_records);
          });
        })
        .catch((e) => {
          reject(e);
        });
    });
  }

  loadCraiFile_() {
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

  loadCramHeader_() {
    const file_definition_length = 26;
    const max_header_length = 23;
    var checked_stream = this.cram_
      .load(0, file_definition_length + max_header_length)
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
        file_definition_length + max_header_length,
        container.getHeaderLength() + container.landmarks[1] - max_header_length
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
        var txt = block.get("IO").readString(block.get("rawSize"));

        // create list of chrname
        var list = [];
        txt.split("\n").forEach((line) => {
          var words = line.split(RegExp(/\t|:/));
          if (words[0] == "@SQ") {
            list.push(words[words.indexOf("SN") + 1]);
          }
        });
        return list;
      }
    );
  }

  loadAllRecordsInSlice_(slice_index) {
    var container = this.loadContainer_(slice_index[3]);
    var arrbuf = container.then((container) => {
      return this.loadSlice_(slice_index, container);
    });
    return Promise.all([container, arrbuf]).then((values) => {
      var slice = new CramSlice(values[0], values[1]);
      return slice.loadRecords();
    });
  }

  loadContainer_(pos) {
    if (this.containers_.has(pos)) {
      return this.containers_get(pos);
    }
    const first_load_length = 4 + 5 * 4 + 9 * 2 + 5 * 2;
    // = 52 (int32, itf8 * 4 + ltf8 * 2 + itf8 * 2)
    var container = this.cram_
      .load(pos, first_load_length)
      .then((arrBuf) => {
        return new CramStream(arrBuf);
      })
      .then((stream) => {
        var container = new CramContainer(stream, pos);
        container.length = container.cram.readInt32();
        container.refSeqId = container.cram.readItf8();
        container.startingRefPos = container.cram.readItf8();
        container.alignmentSpan = container.cram.readItf8();
        container.numberOfRecords = container.cram.readItf8();
        container.recordCounter = container.cram.readLtf8();
        container.bases = container.cram.readLtf8();
        container.numberOfBlocks = container.cram.readItf8();
        container.landmarkscount = container.cram.readItf8();
        return container;
      });
    var second_load_length = container.then((container) => {
      return 5 * container.landmarkscount + 4; // itf8 * count + Uint32
    });
    var second_buffer = second_load_length.then((sll) => {
      return this.cram_.load(pos + first_load_length, sll);
    });
    var compression_header_length = Promise.all([
      container,
      second_buffer,
    ]).then((values) => {
      var container = values[0];
      var buffer = values[1];

      container.cram.concat(buffer);
      var list = [];
      for (var i = 0; i < container.landmarkscount; i++) {
        list.push(container.cram.readItf8());
      }
      container.landmarks = list;
      container.crc32 = container.cram.readUint32();
      container.headerLength = container.cram.tell();
      return container.landmarks[0];
    });
    var third_buffer = Promise.all([
      container,
      compression_header_length,
      second_load_length,
    ]).then((values) => {
      var container = values[0];
      var chl = values[1];
      var sll = values[2];

      const third_load_length =
        chl + container.getHeaderLength() - first_load_length - sll;
      return this.cram_.load(pos + first_load_length + sll, third_load_length);
    });
    this.containers_.set(pos, container);
    return Promise.all([container, third_buffer]).then((values) => {
      var container = values[0];
      var buf = values[1];

      container.cram.concat(buf);
      container.getCompressionHeaderBlock();
      return container;
    });
  }

  loadSlice_(slice_index, container) {
    const slice_pos =
      slice_index[3] + container.getHeaderLength() + slice_index[4];
    const slice_length = slice_index[5];
    return this.cram_.load(slice_pos, slice_length);
  }

  filterRecord_(id, start, end, records) {
    // find reads match with id, start and end
    var filtered = [];
    records.forEach((read) => {
      if (
        read.refSeqId == id &&
        read.position <= end &&
        read.position + read.readLength >= start
      ) {
        filtered.push(read);
      }
    });
    return filtered;
  }

  decorateRecords_(chr_list, record) {
    record.refSeqName = chr_list[record.refSeqId];
    record.restoreCigar();
  }
}
