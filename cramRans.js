class CramRans {
    constructor(input) {
        this.input = new CramFile(input, true, false);
    }

    async ransDecode() {
        const order = await this.input.readInt8();
        const n_in = await this.input.readUint32();
        const n_out = await this.input.readUint32();
        var output = new Uint8Array(n_out);
        if (order == 0) {
            await this.ransDecode0(output, n_out);
        } else {
            await this.ransDecode1(output, n_out);
        }
        return output.buffer;
    }

    async readFrequencies0(F, C) {
        var sym = await this.input.readUint8();
        var last_sym = sym;
        var rle = 0;
        while (true) {
            var f = await this.input.readItf8();
            F[sym] = f;
            if (rle > 0) {
                rle -= 1;
                sym = sym + 1;
            } else {
                sym = await this.input.readUint8();
                if (sym == last_sym + 1){
                    rle = await this.input.readUint8();
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

    async ransRenorm(R) {
        while (R < (1 << 23)) {
            R = (R << 8) + (await this.input.readUint8());
        }
        return R;
    }

    async ransDecode0(output, nbytes) {
        var F = new Array(256).fill(0);
        var C = new Array(256).fill(0);
        var R = new Array(4).fill(0);
        await this.readFrequencies0(F, C);
        for (var j = 0; j < 4; j++) {
            R[j] = await this.input.readUint32();
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
                R[j] = await this.ransRenorm(R[j]);
            }
            i += 4;
        }
    }

    async readFrequencies1(F, C) {
        var sym = await this.input.readUint8();
        var last_sym = sym;
        var rle = 0;
        while (true) {
            await this.readFrequencies0(F[sym], C[sym])
            if (rle > 0) {
                rle = rle - 1;
                sym = sym + 1;
            } else {
                sym = await this.input.readUint8();
                if (sym == last_sym + 1) {
                    rle = await this.input.readUint8();
                }
            }
            last_sym = sym;
            if (sym == 0 || sym == 256) {
                break;
            }
        }
    }

    async ransDecode1(output, nbytes) {
        var F = Array.from(new Array(256), () => new Array(256).fill(0));
        var C = Array.from(new Array(256), () => new Array(256).fill(0));
        var R = new Array(4).fill(0);
        var L = new Array(4).fill(0);
        await this.readFrequencies1(F, C);
        for (var j = 0; j < 4; j++) {
            R[j] = await this.input.readUint32();
            L[j] = 0;
        }
        var i = 0;
        while (i < nbytes / 4) {
            for (var j = 0; j < 4; j++) {
                var f = this.ransGetCumulativeFreq(R[j]);
                var s = this.ransGetSymbolFromFreq(C[L[j]], f);
                output[i + Math.floor(j * nbytes / 4)] = s;
                R[j] = this.ransAdvanceStep(R[j], C[L[j]][s], F[L[j]][s]);
                R[j] = await this.ransRenorm(R[j]);
                L[j] = s;
            }
            i += 1;
        }
        i *= 4;
        while (i < nbytes) {
            f = this.ransGetCumulativeFreq(R[3]);
            s = this.ransGetSymbolFromFreq(C[L[3]], f);
            output[i + Math.floor(3 * nbytes / 4)] = s;
            R[3] = this.ransAdvanceStep(R[3], C[L[3]][s], F[L[3]][s]);
            R[3] = await this.ransRenorm(R[3]);
            L[3] = s;
            i += 1;
        }
        return output;
    }
}
