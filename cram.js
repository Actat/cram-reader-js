class Cram {
  constructor(cram, crai, local_flag) {
    this.local_flag_ = local_flag;
    this.cram_ = new FileHandler(cram, local_flag);
    this.crai_ = new FileHandler(crai, local_flag);
  }

  getRecords(chr, start, end) {
    var index = this.loadCraiFile_();
    var chr_list = this.loadCramHeader_();
    var id = chr_list.then((chr_list) => {
      return chr_list.indexOf(chr);
    });
    return Promise.all([index, id])
      .then((values) => {
        var index = values[0];
        var id = values[1];

        // find slices which match with chr name, start and end
        var filtered_slices = [];
        index.forEach((s) => {
          if (s[0] == id && s[1] <= end && s[1] + s[2] >= start) {
            filtered_slices.push(s);
          }
        });
        return filtered_slices;
      })
      .then((slices) => {
        var recordLists = [];
        slices.forEach((s) => {
          // load records in the slice
          var all_records = this.loadAllRecordsInSlice_(s);
          var filtered = this.filterRecord_(all_records);
          recordLists.push(filtered);
        });
        return recordLists;
      })
      .then((record_lists) => {
        return Promise.all(record_lists).then((lists) => {
          // concat all record lists
          var result = [];
          lists.forEach((list) => {
            result.concat(list);
          });
          return result;
        });
      })
      .then((filtered_records) => {
        return Promise.all(filtered_records).then((records) => {
          records.forEach((record) => {
            this.decorateRecords_(chr_list, record);
          });
          return records;
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
    return this.loadContainer_(slice_index[3])
      .then((container) => {
        return this.loadSlice(slice_index, container);
      })
      .then((slice) => {
        return slice.getRecords();
      });
  }

  filterRecord_(id, start, end, records) {
    // find reads match with id, start and end
    var filtered = [];
    records.forEach((read) => {
      if (
        read.refSeqId == id &&
        read.position <= end &&
        read.position + r.readLength >= start
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
