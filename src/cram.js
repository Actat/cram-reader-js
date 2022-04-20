class Cram {
  constructor(cram, crai, local_flag, fa, fai) {
    if (!cram || !crai) {
      throw "Files are Falsy";
    }
    this.local_flag_ = local_flag;
    this.cram_ = new FileHandler(cram, local_flag);
    this.crai_ = new FileHandler(crai, local_flag);
    this.index_ = undefined;
    this.cache_ = new Map();
    if (fa && fai) {
      this.withFASTA_ = true;
      var fah = new FileHandler(fa, local_flag);
      var faih = new FileHandler(fai, local_flag);
      this.fasta_ = new Fasta(fah, faih);
    } else {
      this.withFASTA_ = false;
    }
    this.containers_ = new Map();
  }

  getRecords(chr, start, end) {
    if (typeof this.index_ === "undefined") {
      this.index_ = this.loadCraiFile_();
    }
    return new Promise((resolve, reject) => {
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
      var p = Promise.all([this.index_, id]).then((values) => {
        var index = values[0];
        var id = values[1];
        var promises = [];

        // find slices which match with chr name, start and end
        index.forEach((s) => {
          if (s[0] == id && s[1] <= end && s[1] + s[2] >= start) {
            var ind = index.indexOf(s);
            if (!this.cache_.has(ind)) {
              this.cache_.set(ind, this.getAllRecordsInSlice_(s, chr_list));
            }
            promises.push(this.cache_.get(ind));
          }
        });
        return promises;
      });
      Promise.all([id, p])
        .then((values) => {
          var id = values[0];
          var promises = values[1];
          return Promise.all(promises)
            .then((record_lists) => {
              // concat all record lists
              var records = [];
              record_lists.forEach((list) => {
                records = records.concat(list);
              });
              resolve(this.filterRecord_(id, start, end, records));
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

  getAllRecordsInSlice_(slice_index, chr_list) {
    var decorated_promises = [];
    return this.loadAllRecordsInSlice_(slice_index)
      .then((recs) => {
        recs.forEach((rec) => {
          decorated_promises.push(this.decorateRecords_(chr_list, rec));
        });
      })
      .then(() => {
        return Promise.all(decorated_promises).then((recs) => {
          var record_list = [];
          recs.forEach((rec) => {
            record_list.push(rec);
          });
          return record_list;
        });
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
      this.containers_.set(pos, c);
      resolve(c);
    });
  }

  loadSlice_(slice_index, container) {
    return container.loadHeaderLength().then((length) => {
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

  async decorateRecords_(chr_list, record) {
    record.refSeqName = chr_list[record.refSeqId];
    record.restoreCigar();
    if (this.withFASTA_) {
      await record.restoreSequence(this.fasta_);
    }
    record.samString = record.toSAMString();
    return record;
  }
}
