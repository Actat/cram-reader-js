class Fasta {
  constructor(fa, fai) {
    // fa and fai are FileHandler
    if (!fa || !fai) {
      throw "Files are Falsy";
    }
    this.fa_ = fa;
    this.fai_ = fai;
    this.faindex_ = this.loadFai_();
  }

  laodSequence(chr, position, length) {
    var endpos = position + length;
    return this.faindex_
      .then((faindex) => {
        const index = faindex.find((elem) => {
          return elem[0] == chr;
        });
        if (typeof index === "undefined") {
          throw "Chromosome (" + chr + ") is not found in faindex.";
        }
        if (position < 0 || endpos > index[1]) {
          throw "out of bounds";
        }
        var start = this.getBytePos_(position, index[2], index[3], index[4]);
        var end = this.getBytePos_(endpos, index[2], index[3], index[4]);
        return this.fa_.load(start, end - start);
      })
      .then((arraybuffer) => {
        var str = String.fromCharCode.apply("", new Uint8Array(arraybuffer));
        return str.replace(/\r?\n/g, "");
      });
  }

  getBytePos_(pos, offset, linebases, linewidth) {
    var m = pos % linebases;
    var n = (pos - m) / linebases;
    return offset + linewidth * n + m;
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
