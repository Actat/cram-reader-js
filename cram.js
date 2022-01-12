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
      var chr_list;
      var header = new CramHeader(this.cram_);

      var id = header
        .loadChrList()
        .then((cl) => {
          chr_list = cl;
          return cl.indexOf(chr);
        })
        .catch((e) => {
          reject(e);
        });
      var record_lists = [];
      Promise.all([index, id])
        .then((values) => {
          var index = values[0];
          var id = values[1];
          var promises = [];

          // find slices which match with chr name, start and end
          index.forEach((s) => {
            if (s[0] == id && s[1] <= end && s[1] + s[2] >= start) {
              var records_have_pushed = this.loadAllRecordsInSlice_(s).then(
                (records) => {
                  var filtered = this.filterRecord_(id, start, end, records);
                  record_lists.push(filtered);
                }
              );
              promises.push(records_have_pushed);
            }
          });
          return promises;
        })
        .then((promises) => {
          Promise.all(promises)
            .then(() => {
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
            })
            .catch((e) => {
              reject(e);
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
          console.log(
            "The crai file may be wrong, or a meddlesome browser may have unzipped it."
          );
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
    return new Promise((resolve, reject) => {
      if (this.containers_.has(pos)) {
        resolve(this.containers_.get(pos));
      }
      var c = new CramDataContainer(this.cram_, pos);
      c.loadCompressionHeaderBlock();
      this.containers_.set(pos, c);
      resolve(c);
    });
  }

  loadSlice_(slice_index, container) {
    return container.getHeaderLength().then((length) => {
      const slice_pos = slice_index[3] + length + slice_index[4];
      const slice_length = slice_index[5];
      return this.cram_.load(slice_pos, slice_length);
    });
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
