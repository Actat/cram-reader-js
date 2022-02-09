class Fasta {
  constructor(fa, fai, cache_size = 0) {
    // fa and fai are FileHandler
    if (!fa || !fai) {
      throw "Files are Falsy";
    }
    this.fa_ = fa;
    this.fai_ = fai;
    this.faindex_ = this.loadFai_();
    this.changeBase_ = {
      A: "T",
      T: "A",
      G: "C",
      C: "G",
      R: "Y",
      Y: "R",
      M: "K",
      K: "M",
      B: "V",
      V: "B",
      D: "H",
      H: "D",
      a: "t",
      t: "a",
      g: "c",
      c: "g",
      r: "y",
      y: "r",
      m: "k",
      k: "m",
      b: "v",
      v: "b",
      d: "h",
      h: "d",
    };
    this.cache_size_ = cache_size;
    if (this.cache_size_ > 0) {
      this.cache_ = [
        [
          new Date(),
          "",
          1,
          cache_size,
          new Promise((resolve) => {
            resolve("N".repeat(cache_size));
          }),
        ],
      ];
    }
  }

  loadSequence(chr, start, end, strand = "+") {
    return this.loadSeq(chr, start, end).then((seq) => {
      if (strand !== "-" && strand !== -1) {
        return seq;
      } else {
        return this.reverseComplement_(seq);
      }
    });
  }

  async loadSeq(chr, start, end) {
    if (!this.cache_) {
      return await this.loadFromSource_(chr, start, end);
    }
    var fragments = [];
    this.cache_.sort((a, b) => {
      return a[2] - b[2];
    });
    for (var i = 0; i < this.cache_.length; i++) {
      var elem = this.cache_[i];
      if (elem[1] == chr && elem[2] <= start && elem[3] >= end) {
        // entire data is in this element of cache
        this.cache_[i][0] = new Date();
        var start_index = start - elem[2];
        var end_index = start_index + (end - start) + 1;
        var cache_seq = await elem[4];
        return cache_seq.slice(start_index, end_index);
      } else if (elem[1] == chr && elem[2] <= end && elem[3] >= start) {
        // part of data is in this element of cache
        fragments.push([elem, i]);
      }
    }

    if (fragments.length == 0) {
      // no data is in this element of cache
      var seq = this.loadFromSource_(chr, start, end);
      this.cache_.push([new Date(), chr, start, end, seq]);
      this.shrinkCache_(end - start + 1);
      return await seq;
    }

    fragments[0][0][4].then((seq) => {});
    var load_length = 0;
    if (fragments[0][0][2] > start) {
      var p_seq = this.loadFromSource_(chr, start, fragments[0][2] - 1);
      load_length += fragments[0][2] - start;
      this.cache_[fragments[0][1]][0] = new Date();
      this.cache_[fragments[0][1]][2] = start;
      this.cache_[fragments[0][1]][4] = Promise.all([
        p_seq,
        this.cache_[fragments[0][1]][4],
      ]).then((values) => {
        return values[0].concat(values[1]);
      });
    }
    if (fragments.length >= 2) {
      for (var i = 1; i < fragments.length; i++) {
        var p_loaded_seq = this.loadFromSource_(
          chr,
          this.cache_[fragments[i - 1][1]][3] + 1,
          fragments[i][0][2] - 1
        );
        load_length +=
          fragments[i][0][2] - this.cache_[fragments[i - 1][1]][3] - 1;
        this.cache_[fragments[0][1]][0] = new Date();
        this.cache_[fragments[0][1]][3] = fragments[i][0][3];
        this.cache_[fragments[0][1]][4] = p_loaded_seq.then((loaded_seq) => {
          return this.cache_[fragments[0][1]][4].concat(loaded_seq);
        });
        this.cache_[fragments[0][1]][4] = Promise.all([
          this.cache_[fragments[0][1]][4],
          fragments[i][0][4],
        ]).then((values) => {
          return values[0].concat(values[1]);
        });
      }
    }
    if (fragments[fragments.length - 1][0][3] < end) {
      var p_seq = this.loadFromSource_(
        chr,
        fragments[fragments.length - 1][0][3] + 1,
        end
      );
      load_length += end - fragments[fragments.length - 1][0][3];
      this.cache_[fragments[0][1]][0] = new Date();
      this.cache_[fragments[0][1]][3] = end;
      this.cache_[fragments[0][1]][4] = Promise.all([
        this.cache_[fragments[0][1]][4],
        p_seq,
      ]).then((values) => {
        return values[0].concat(values[1]);
      });
    }

    if (fragments.length >= 2) {
      for (var i = 1; i < fragments.length; i++) {
        var index = this.cache_.indexOf(fragments[i][0]);
        this.cache_.splice(index, 1);
      }
    }
    this.shrinkCache_(load_length);
    return this.loadSeq(chr, start, end);
  }

  getBytePos_(pos, offset, linebases, linewidth) {
    // pos is 1-start coordinate
    var m = (pos - 1) % linebases;
    var n = (pos - 1 - m) / linebases;
    return offset + linewidth * n + m;
  }

  loadFromSource_(chr, start, end) {
    return this.faindex_
      .then((faindex) => {
        const index = faindex.find((elem) => {
          return elem[0] == chr;
        });
        if (typeof index === "undefined") {
          throw "Chromosome (" + chr + ") is not found in faindex.";
        }
        if (start < 1 || end > index[1]) {
          throw "out of bounds";
        }
        var start_byte = this.getBytePos_(start, index[2], index[3], index[4]);
        var end_byte = this.getBytePos_(end, index[2], index[3], index[4]);
        return this.fa_.load(start_byte, end_byte - start_byte + 1);
      })
      .then((arraybuffer) => {
        var str = String.fromCharCode.apply("", new Uint8Array(arraybuffer));
        return str.replace(/\r?\n/g, "");
      });
  }

  reverseComplement_(seq) {
    var retval = new String("");
    for (var i = 0; i < seq.length; i++) {
      retval = this.changeBase_[seq.charAt(i)].concat(retval);
    }
    return retval;
  }

  shrinkCache_(length) {
    this.cache_.sort((a, b) => {
      return a[0] - b[0];
    });
    while (length >= this.cache_[0][3] - this.cache_[0][2] + 1) {
      length -= this.cache_[0][3] - this.cache_[0][2] + 1;
      this.cache_.splice(0, 1);
    }
    this.cache_[0][2] += length;
    this.cache_[0][4] = this.cache_[0][4].then((seq) => {
      return seq.slice(length);
    });
  }

  loadFai_() {
    return this.fai_.load().then((arraybuffer) => {
      var faindex = [];
      var fai = String.fromCharCode.apply("", new Uint8Array(arraybuffer));
      var lines = fai.split("\n");
      lines.forEach((line) => {
        var l = line.split("\t");
        if (l.length == 5) {
          faindex.push([
            l[0],
            parseInt(l[1], 10),
            parseInt(l[2], 10),
            parseInt(l[3], 10),
            parseInt(l[4], 10),
          ]);
        }
      });
      return faindex;
    });
  }
}
