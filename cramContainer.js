class CramContainer {
  constructor(/*FileHandler*/ cram, pos) {
    this.file_ = cram;
    this.pos_ = pos;
    this.header_length_ = undefined;
    this.stream_ = undefined;
    this.first_load_length_ = 4 + 5 * 4 + 9 * 2 + 5 * 2;
    // = 52 (int32, itf8 * 4 + ltf8 * 2 + itf8 * 2)
    this.second_load_length_ = undefined;
    this.third_load_length_ = undefined;
  }

  getPosition() {
    return this.pos_;
  }

  getHeaderLength() {
    return this.loadHeader_().then(() => {
      return this.header_length_;
    });
  }

  loadHeader_() {
    return this.file_
      .load(this.pos_, this.first_load_length_)
      .then((arrBuf) => {
        this.stream_ = new CramStream(arrBuf);

        this.length = this.stream_.readInt32();
        this.ref_id = this.stream_.readItf8();
        this.starting_ref_pos = this.stream_.readItf8();
        this.alignment_span = this.stream_.readItf8();
        this.number_records = this.stream_.readItf8();
        this.record_counter = this.stream_.readLtf8();
        this.bases = this.stream_.readLtf8();
        this.number_blocks = this.stream_.readItf8();
        this.landmarks_count_ = this.stream_.readItf8();

        var remain_len = this.first_load_length_ - this.stream_.tell();
        this.second_load_length_ = 5 * this.landmarks_count_ + 4 - remain_len; // itf8 * count + Uint32
        if (this.second_load_length_ > 0) {
          return this.file_.load(
            this.pos_ + this.first_load_length_,
            this.second_load_length_
          );
        } else {
          this.second_load_length_ = 0;
        }
      })
      .then((second_buffer) => {
        if (second_buffer) {
          this.stream_.concat(second_buffer);
        }
        var list = [];
        for (var i = 0; i < this.landmarks_count_; i++) {
          list.push(this.stream_.readItf8());
        }
        this.landmarks = list;
        this.crc32 = this.stream_.readUint32();
        this.header_length_ = this.stream_.tell();
        return this.header_length_;
      });
  }
}
