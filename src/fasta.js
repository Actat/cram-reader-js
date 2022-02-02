class Fasta {
  constructor(fa, fai) {
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
  }

  laodSequence(chr, start, end, strand = "+") {
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
      })
      .then((seq) => {
        if (strand !== "-" && strand !== -1) {
          return seq;
        } else {
          return this.reverseComplement_(seq);
        }
      });
  }

  getBytePos_(pos, offset, linebases, linewidth) {
    // pos is 1-start coordinate
    var m = (pos - 1) % linebases;
    var n = (pos - 1 - m) / linebases;
    return offset + linewidth * n + m;
  }

  reverseComplement_(seq) {
    var retval = new String("");
    for (var i = 0; i < seq.length; i++) {
      retval = this.changeBase_[seq.charAt(i)].concat(retval);
    }
    return retval;
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
