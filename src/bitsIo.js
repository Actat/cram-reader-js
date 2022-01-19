class BitsIO {
  constructor(arrBuf) {
    this.array_ = new Uint8Array(arrBuf);
    this.array_index_ = 0;
    this.byte_ = 0;
    this.byte_index_ = 0;
    this.popNextByte_();
  }

  read(size) {
    var i = 0;
    var j = size;
    while (j > 0) {
      i += this.readNextBit_() * 2 ** (j - 1);
      j -= 1;
    }
    return i;
  }

  readNextBit_() {
    const i = (this.byte_ & (2 ** this.byte_index_)) >> this.byte_index_;
    if (this.byte_index_ == 0) {
      this.popNextByte_();
    } else {
      this.byte_index_ -= 1;
    }
    return i;
  }

  popNextByte_() {
    this.byte_ = this.array_[this.array_index_];
    this.array_index_ += 1;
    this.byte_index_ = 7;
  }
}
