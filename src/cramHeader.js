class CramHeader extends CramContainer {
  constructor(/*FileHandler*/ cram) {
    super(cram, 26);

    this.fileid = undefined;
    this.chr_list = undefined;
    this.file_definition_length_ = 26;
    this.max_header_length_ = 23;
    this.first_load_length_ =
      this.file_definition_length_ + this.max_header_length_;
    this.header_length_ = undefined;
  }

  loadChrList() {
    if (typeof this.chr_list !== "undefined") {
      return this.chr_list;
    }
    if (typeof this.header_length_ === "undefined") {
      this.header_length_ = this.loadHeader_();
    }

    this.chr_list = this.header_length_.then((header_length) => {
      var block = this.stream_.readBlock(this.pos_ + header_length);
      var txt = block.get("IO").readString(block.get("rawSize"));

      // create list of chrname
      var list = [];
      txt.split("\n").forEach((line) => {
        var words = line.split(RegExp(/\t|:/));
        if (words[0] == "@SQ") {
          list.push(words[words.indexOf("SN") + 1]);
        }
      });
      return list;
    });
    return this.chr_list;
  }

  loadHeader_() {
    var head_len = this.file_
      .load(0, this.first_load_length_)
      .then((arrBuf) => {
        this.stream_ = new CramStream(arrBuf);

        // process file definition
        // check file signature
        var head = this.stream_.readString(4);
        var version = new Uint8Array(this.stream_.read(2));
        if (head !== "CRAM" || version[0] !== 3 || version[1] !== 0) {
          throw "[invalid file signature] This file is not CRAM 3.0 file.";
        }

        // read file id
        this.fileid = this.stream_.readString(20);

        this.length = this.stream_.readInt32();
        this.ref_id = this.stream_.readItf8();
        this.starting_ref_pos = this.stream_.readItf8();
        this.alignment_span = this.stream_.readItf8();
        this.number_records = this.stream_.readItf8();
        this.record_counter = this.stream_.readLtf8();
        this.bases = this.stream_.readLtf8();
        this.number_blocks = this.stream_.readItf8();
        this.landmarks = this.stream_.readArrayItf8();
        this.crc32 = this.stream_.readUint32();
        var header_length = this.stream_.tell() - this.file_definition_length_;
        return header_length;
      });
    var second_buf = head_len.then((header_length) => {
      this.second_load_length_ =
        header_length + this.landmarks[1] - this.max_header_length_;
      return this.file_.load(this.first_load_length_, this.second_load_length_);
    });
    return Promise.all([head_len, second_buf]).then((values) => {
      this.stream_.concat(values[1]);
      return values[0];
    });
  }
}
