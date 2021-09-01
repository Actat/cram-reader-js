class BitsIO {
    constructor(arrBuf) {
        this.array = new Uint8Array(arrBuf);
        this.index = 0;
        this.popNextByte();
    }

    read(size) {
        var i = 0;
        var j = size;
        while (j > 0) {
            i += this.readNextBit() * (2 ** (j - 1))
            j -= 1
        }
        return i
    }

    readNextBit() {
        const i = (this.buffer & (2 ** this.pos)) >> this.pos
        if (this.pos == 0) {
            this.popNextByte();
        } else {
            this.pos -= 1
        }
        return i
    }

    popNextByte() {
        this.buffer = this.array[this.index];
        this.index += 1;
        this.pos = 7;
    }
}
