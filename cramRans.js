class CramRans {
    constructor(input) {
        this.input = new CramFile(input);
    }

    ransDecode() {
        const order = this.input.readInt8();
        const n_in = this.input.readUint32();
        const n_out = this.input.readUint32();
        var output = new Uint8Array(n_out);
        if (order == 0) {
            this.ransDecode0(output, n_out);
        } else {
            this.ransDecode1(output, n_out);
        }
        return output.buffer;
    }

    readFrequencies0(F, C) {
        var sym = this.input.readUint8();
        var last_sym = sym;
        var rle = 0;
        while (true) {
            var f = this.input.readItf8();
            F[sym] = f;
            if (rle > 0) {
                rle -= 1;
                sym = sym + 1;
            } else {
                sym = this.input.readUint8();
                if (sym == last_sym + 1){
                    rle = this.input.readUint8();
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

    ransGetCumulativeFreq(R) {
        return R & 0xfff;
    }

    ransGetSymbolFromFreq(C, f) {
        var s = 0;
        while (s + 1 < C.length && f >= C[s + 1]) {
            s += 1;
        }
        return s;
    }

    ransAdvanceStep(R, c, f) {
        return f * (R >> 12) + (R & 0xfff) - c;
    }

    ransRenorm(R) {
        while (R < (1 << 23)) {
            R = (R << 8) + this.input.readUint8();
        }
        return R;
    }

    ransDecode0(output, nbytes) {
        var F = new Array(256).fill(0);
        var C = new Array(256).fill(0);
        var R = new Array(4).fill(0);
        this.readFrequencies0(F, C);
        for (var j = 0; j < 4; j++) {
            R[j] = this.input.readUint32();
        }
        var i = 0;
        while (i < nbytes) {
            for (var j = 0; j < 4; j++) {
                if (i + j >= nbytes) {
                    return;
                }
                var f = this.ransGetCumulativeFreq(R[j]);
                var s = this.ransGetSymbolFromFreq(C, f);
                output[i + j] = s;
                R[j] = this.ransAdvanceStep(R[j], C[s], F[s]);
                R[j] = this.ransRenorm(R[j]);
            }
            i += 4;
        }
    }

    readFrequencies1(F, C) {
        var sym = this.input.readUint8();
        var last_sym = sym;
        var rle = 0;
        while (true) {
            this.readFrequencies0(F[sym], C[sym])
            if (rle > 0) {
                rle = rle - 1;
                sym = sym + 1;
            } else {
                sym = this.input.readUint8();
                if (sym == last_sym + 1) {
                    rle = this.input.readUint8();
                }
            }
            last_sym = sym;
            if (sym == 0 || sym == 256) {
                break;
            }
        }
    }

    ransDecode1(output, nbytes) {
        var F = new Array(256).fill(new Array(256).fill(0));
        var C = new Array(256).fill(new Array(256).fill(0));
        var R = new Array(4).fill(0);
        var L = new Array(4).fill(0);
        this.readFrequencies1(F, C);
        for (var j = 0; j < 4; j++) {
            R[j] = this.input.readUint32();
            L[j] = 0;
        }
        var i = 0;
        while (i < nbytes / 4) {
            for (var j = 0; j < 4; j++) {
                var f = this.ransGetCumulativeFreq(R[j]);
                var s = this.ransGetSymbolFromFreq(C[L[j]], f);
                output[i + j * Math.floor(nbytes / 4)] = s;
                R[j] = this.ransAdvanceStep(R[j], C[L[j]][s], F[L[j]][s]);
                R[j] = this.ransRenorm(R[j]);
                L[j] = s;
            }
            i += 1;
        }
        i *= 4;
        while (i < nbytes) {
            f = this.ransGetCumulativeFreq(R[3]);
            s = this.ransGetSymbolFromFreq(C[L[3]], f);
            output[i + 3 * Math.floor(nbytes / 4)] = s;
            R[3] = this.ransAdvanceStep(R[3], C[L[3]][s], F[L[3]][s]);
            R[3] = this.ransRenorm(R[3]);
            L[3] = s;
            i += 1;
        }
        return output;
    }
}
