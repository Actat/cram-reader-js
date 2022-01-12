class CramDataContainer extends CramContainer {
  constructor(/*FileHandler*/ cram, pos) {
    super(cram, pos);
    this.compression_header_ = undefined;
  }

  loadCompressionHeaderBlock() {
    if (this.compression_header_) {
      return this.compression_header_;
    }

    if (this.header_length_) {
      this.third_load_length_ =
        this.landmarks[0] +
        this.header_length_ -
        this.first_load_length_ -
        this.second_load_length_;
      return this.file_
        .load(
          this.pos_ + this.first_load_length_ + this.second_load_length_,
          this.third_load_length_
        )
        .then((third_buffer) => {
          this.stream_.concat(third_buffer);
          return this.readCompressionHeaderBlock_();
        });
    }

    return this.loadHeader().then(() => {
      return this.loadCompressionHeaderBlock();
    });
  }

  readCompressionHeaderBlock_() {
    var b = this.stream_.readBlock(this.header_length_);
    var chb = new Map();
    const data = b.get("IO");
    // preservation map
    {
      chb.set("pm", new Map());
      chb.get("pm").set("RN", true);
      chb.get("pm").set("AP", true);
      chb.get("pm").set("RR", true);
      const size = data.readItf8();
      const number = data.readItf8();
      for (var i = 0; i < number; i++) {
        const k = String.fromCharCode.apply("", new Uint8Array(data.read(2)));
        var v;
        if (k == "RN" || k == "AP" || k == "RR") {
          v = data.readBoolean();
        } else if (k == "SM") {
          v = data.read(5);
        } else if (k == "TD") {
          v = this.decodeTagDictionary(data.readArrayByte());
        } else {
          continue;
        }
        chb.get("pm").set(k, v);
      }
    }
    // data series encodings
    {
      chb.set("dse", new Map());
      const size = data.readItf8();
      const number = data.readItf8();
      for (var i = 0; i < number; i++) {
        const k = String.fromCharCode.apply("", new Uint8Array(data.read(2)));
        var v;
        if (
          [
            "BF",
            "CF",
            "RI",
            "RL",
            "AP",
            "RG",
            "MF",
            "NS",
            "NP",
            "TS",
            "NF",
            "TL",
            "FN",
            "FP",
            "DL",
            "RS",
            "PD",
            "HC",
            "MQ",
          ].includes(k)
        ) {
          v = data.readEncodingInt();
        } else if (["RN", "BB", "QQ", "IN", "SC"].includes(k)) {
          v = data.readEncodingByteArray();
        } else if (["FC", "BS", "BA", "QS"].includes(k)) {
          v = data.readEncodingByte();
        } else {
          continue;
        }
        chb.get("dse").set(k, v);
      }
    }
    // tag encoding map
    {
      chb.set("tv", new Map());
      const size = data.readItf8();
      const number = data.readItf8();
      for (var i = 0; i < number; i++) {
        const k = data.readItf8();
        const key = String.fromCharCode(
          (k & 0xff0000) >> 16,
          (k & 0xff00) >> 8,
          k & 0xff
        );
        const v = data.readEncodingByteArray();
        chb.get("tv").set(key, v);
      }
    }
    b.set("content", chb);
    this.compression_header_ = b;
    return this.compression_header_;
  }

  decodeTagDictionary(arrBuf) {
    var data = new Int8Array(arrBuf);
    var d = [];
    var i = 0;
    while (i + 2 < arrBuf.byteLength) {
      var tmp = [];
      while (data[i] != "\0".charCodeAt(0)) {
        var tagId = String.fromCharCode(data[i], data[i + 1]);
        var tagType = String.fromCharCode(data[i + 2]);
        tmp.push(tagId + tagType);
        i += 3;
      }
      d.push(tmp);
      i += 1;
    }
    return d;
  }
}
