class CramRans {
  constructor(/*ArrayBuffer*/ input) {
    this.input_ = new CramStream(input);
  }

  ransDecode() {
    const order = this.input_.readInt8();
    const n_in = this.input_.readUint32();
    const n_out = this.input_.readUint32();
    var output = new Uint8Array(n_out);
    if (order == 0) {
      this.ransDecode0_(output, n_out);
    } else {
      this.ransDecode1_(output, n_out);
    }
    return output.buffer;
  }

  readFrequencies0_(F, C) {
    var sym = this.input_.readUint8();
    var last_sym = sym;
    var rle = 0;
    while (true) {
      var f = this.input_.readItf8();
      F[sym] = f;
      if (rle > 0) {
        rle -= 1;
        sym = sym + 1;
      } else {
        sym = this.input_.readUint8();
        if (sym == last_sym + 1) {
          rle = this.input_.readUint8();
        }
      }
      last_sym = sym;
      if (sym == 0 || sym == 256) {
        break;
      }
    }
    C[0] = 0;
    for (var i = 0; i < 255; i++) {
      C[i + 1] = C[i] + F[i];
    }
  }

  ransGetCumulativeFreq_(R) {
    return R & 0xfff;
  }

  ransGetSymbolFromFreq_(C, f) {
    var s = 0;
    while (s + 1 < C.length && f >= C[s + 1]) {
      s += 1;
    }
    return s;
  }

  ransAdvanceStep_(R, c, f) {
    return f * (R >> 12) + (R & 0xfff) - c;
  }

  ransRenorm_(R) {
    while (R < 1 << 23) {
      R = (R << 8) + this.input_.readUint8();
    }
    return R;
  }

  ransDecode0_(output, nbytes) {
    var F = new Array(256).fill(0);
    var C = new Array(256).fill(0);
    var R = new Array(4).fill(0);
    this.readFrequencies0_(F, C);
    for (var j = 0; j < 4; j++) {
      R[j] = this.input_.readUint32();
    }
    var i = 0;
    while (i < nbytes) {
      for (var j = 0; j < 4; j++) {
        if (i + j >= nbytes) {
          return;
        }
        var f = this.ransGetCumulativeFreq_(R[j]);
        var s = this.ransGetSymbolFromFreq_(C, f);
        output[i + j] = s;
        R[j] = this.ransAdvanceStep_(R[j], C[s], F[s]);
        R[j] = this.ransRenorm_(R[j]);
      }
      i += 4;
    }
  }

  readFrequencies1_(F, C) {
    var sym = this.input_.readUint8();
    var last_sym = sym;
    var rle = 0;
    while (true) {
      this.readFrequencies0_(F[sym], C[sym]);
      if (rle > 0) {
        rle = rle - 1;
        sym = sym + 1;
      } else {
        sym = this.input_.readUint8();
        if (sym == last_sym + 1) {
          rle = this.input_.readUint8();
        }
      }
      last_sym = sym;
      if (sym == 0 || sym == 256) {
        break;
      }
    }
  }

  ransDecode1_(output, nbytes) {
    var F = Array.from(new Array(256), () => new Array(256).fill(0));
    var C = Array.from(new Array(256), () => new Array(256).fill(0));
    var R = new Array(4).fill(0);
    var L = new Array(4).fill(0);
    this.readFrequencies1_(F, C);
    for (var j = 0; j < 4; j++) {
      R[j] = this.input_.readUint32();
      L[j] = 0;
    }
    var i = 0;
    while (i < nbytes / 4) {
      for (var j = 0; j < 4; j++) {
        var f = this.ransGetCumulativeFreq_(R[j]);
        var s = this.ransGetSymbolFromFreq_(C[L[j]], f);
        output[i + Math.floor((j * nbytes) / 4)] = s;
        R[j] = this.ransAdvanceStep_(R[j], C[L[j]][s], F[L[j]][s]);
        R[j] = this.ransRenorm_(R[j]);
        L[j] = s;
      }
      i += 1;
    }
    i *= 4;
    while (i < nbytes) {
      f = this.ransGetCumulativeFreq_(R[3]);
      s = this.ransGetSymbolFromFreq_(C[L[3]], f);
      output[i + Math.floor((3 * nbytes) / 4)] = s;
      R[3] = this.ransAdvanceStep_(R[3], C[L[3]][s], F[L[3]][s]);
      R[3] = this.ransRenorm_(R[3]);
      L[3] = s;
      i += 1;
    }
    return output;
  }
}
