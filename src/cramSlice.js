class CramSlice {
  constructor(container, arr_buf) {
    this.container_ = container;
    this.stream_ = new CramStream(arr_buf);
    this.slice_header_ = undefined;
    this.block_list_ = [];
  }

  async loadRecords() {
    this.getSliceHeaderBlock_();
    this.getBlocks_();
    this.block_list_[0].set(
      "IO",
      new BitsIO(this.block_list_[0].get("IO").arrayBuffer())
    );
    const n_records = this.slice_header_.get("content").get("numberOfRecords");
    var records = [];
    for (var i = 0; i < n_records; i++) {
      var bf = await this.readItem_("BF", "Int");
      var cf = await this.readItem_("CF", "Int");
      var r = new CramRecord(bf, cf);
      await this.decodePositions_(r);
      await this.decodeNames_(r);
      await this.decodeMateData_(r);
      await this.decodeTagData_(r);
      if ((r.getBf() & 4) == 0) {
        await this.decodeMappedRead_(r);
      } else {
        await this.decodeUnmappedRead_(r);
      }
      records.push(r);
    }
    this.decodeTotalMateData_(records);
    return records;
  }

  getSliceHeaderBlock_() {
    var b = this.stream_.readBlock(0);
    var data = b.get("IO");
    b.set("content", new Map());
    b.get("content").set("refSeqId", data.readItf8());
    b.get("content").set("alignmentStart", data.readItf8());
    b.get("content").set("alignmentSpan", data.readItf8());
    b.get("content").set("numberOfRecords", data.readItf8());
    b.get("content").set("recordCounter", data.readItf8());
    b.get("content").set("numberOfBlocks", data.readItf8());
    b.get("content").set("blockContentIds", data.readArrayItf8());
    b.get("content").set("embeddedRefBasesBlockContentId", data.readItf8());
    b.get("content").set("refMD5", data.read(16));
    //b.get('content').set('optionalTags', data.readArrayByte());
    this.slice_header_ = b;
    return b;
  }

  getBlocks_() {
    const n_blocks =
      1 + this.slice_header_.get("content").get("blockContentIds").length; // +1 for core data block
    var blocks = [];
    this.stream_.seek(this.slice_header_.get("blockSize"));
    for (var i = 0; i < n_blocks; i++) {
      var b = this.stream_.readBlock();
      blocks.push(b);
    }
    this.block_list_ = blocks;
    return blocks;
  }

  async readItem_(key, type) {
    var header = await this.container_.loadCompressionHeaderBlock();
    var codec = header.get("content").get("dse").get(key);
    return this.decodeItem_(codec, type);
  }

  decodeItem_(codec, type) {
    var codec_id = codec.get("codecId");
    if (codec_id == 1) {
      // return int or arrayBuffer
      var io = this.getBlockByExternalId_(codec.get("externalId")).get("IO");
      if (type == "Int") {
        return io.readItf8();
      } else if (type == "Byte") {
        return io.read(1);
      } else {
        throw "type " + type + " is not supported. (codecId: 1)";
      }
    } else if (codec_id == 3) {
      // HUFFMAN
      const al = codec.get("alphabet");
      const bl = codec.get("bit-length");
      if (bl.length == 1 && bl[0] == 0) {
        return al[0];
      } else {
        throw "HUFFMAN decoding is in the process of being implemented.";
      }
    } else if (codec_id == 5) {
      // BYTE_ARRAY_STOP
      // return array
      var io = this.getBlockByExternalId_(codec.get("externalId")).get("IO");
      var a = [];
      var cf = new CramStream(codec.get("stopByte"));
      const stopByte = cf.readUint8();
      while (true) {
        var c = io.readUint8();
        if (c == stopByte) {
          return a;
        }
        a.push(c);
      }
    } else if (codec_id == 6) {
      // Beta coding
      // Int only
      return (
        this.block_list_[0].get("IO").read(codec.get("length")) -
        codec.get("offset")
      );
    } else {
      throw "codecId: " + str(codec_id) + " is not supported.";
    }
  }

  getBlockByExternalId_(id) {
    var index = this.slice_header_
      .get("content")
      .get("blockContentIds")
      .indexOf(id);
    return this.block_list_[index + 1]; // +1 for core data block
  }

  async decodePositions_(r) {
    if (this.slice_header_.get("content").get("refSeqId") == -2) {
      r.refSeqId = await this.readItem_("RI", "Int");
    } else {
      r.refSeqId = this.slice_header_.get("content").get("refSeqid");
    }
    r.readLength = await this.readItem_("RL", "Int");
    var header = await this.container_.loadCompressionHeaderBlock();
    if (header.get("content").get("pm").get("AP") != 0) {
      if (typeof this.last_position_ == "undefined") {
        this.last_position_ = this.slice_header_
          .get("content")
          .get("alignmentStart");
      }
      var p = await this.readItem_("AP", "Int");
      r.position = p + this.last_position_;
      this.last_position_ = r.position;
    } else {
      var p = await this.readItem_("AP", "Int");
      r.position = p;
    }
    r.readGroup = await this.readItem_("RG", "Int");
  }

  async decodeNames_(r) {
    var header = await this.container_.loadCompressionHeaderBlock();
    if (header.get("content").get("pm").get("RN")) {
      var rn = await this.readItem_("RN", "ByteArray");
      var name = "";
      rn.forEach((elem) => {
        name += String.fromCharCode(elem);
      });
      r.readName = name;
    } else {
      r.readName = this.generateName_(r);
    }
  }

  generateName_(r) {
    generatedName =
      "generatedName" + String(r.refSeqId) + "." + String(r.position);
    return generatedName;
  }

  async decodeMateData_(r) {
    if ((r.getCf() & 2) == 2) {
      // the next fragment is not in the current slice
      const mateFlag = await this.readItem_("MF", "Int");
      if ((mateFlag & 1) == 1) {
        r.setBf(r.getBf() | 0x20);
      }
      if ((mateFlag & 2) == 2) {
        r.setBf(r.getBf() | 0x08);
      }
      var header = await this.container_.loadCompressionHeaderBlock();
      if (!header.get("content").get("pm").get("RN")) {
        rn = await this.readItem_("RN", "ByteArray");
        r.readName = String(rn);
      }
      r.mateRefId = await this.readItem_("NS", "Int");
      r.matePos = await this.readItem_("NP", "Int");
      r.templateSize = await this.readItem_("TS", "Int");
    } else if ((r.getCf() & 4) == 4) {
      r.nextFrag = await this.readItem_("NF", "Int");
    }
  }

  async decodeTagData_(r) {
    const tagLine = await this.readItem_("TL", "Int");
    var header = await this.container_.loadCompressionHeaderBlock();
    var tags = {};
    const readTagFunc = (elm) => {
      var name = elm.slice(0, 2);
      const tagType = elm.slice(-1);
      var values_encoding = header
        .get("content")
        .get("tv")
        .get(elm)
        .get("valuesEncoding");
      var tag_value;
      if (tagType == "A") {
        tag_value = this.decodeItem_(values_encoding, "Char");
      } else if (
        tagType == "c" ||
        tagType == "C" ||
        tagType == "s" ||
        tagType == "S" ||
        tagType == "i" ||
        tagType == "I"
      ) {
        tag_value = this.decodeItem_(values_encoding, "Int");
      } else if (tagType == "f") {
        tag_value = this.decodeItem_(values_encoding, "float32");
      } else if (tagType == "Z") {
        tag_value = this.decodeItem_(values_encoding, "String");
      } else if (tagType == "H") {
        tag_value = this.decodeItem_(values_encoding, "Hstring");
      } else if (tagType == "B") {
        tag_value = this.decodeItem_(values_encoding, "ByteArray");
      } else {
        console.error("tagType'" + String(tagType) + "' is not supported.");
        return;
      }
      tags[elm] = tag_value;
    };
    for (var elm of header.get("content").get("pm").get("TD")[tagLine])
      readTagFunc(elm);
    r.tags = tags;
  }

  async decodeMappedRead_(r) {
    const featureNumber = await this.readItem_("FN", "Int");
    for (var i = 0; i < featureNumber; i++) {
      await this.decodeFeature_(r);
    }
    r.mappingQuality = await this.readItem_("MQ", "Int");
    var header = await this.container_.loadCompressionHeaderBlock();
    if (header.get("content").get("dse").has("QS")) {
      r.qualityScore = await this.readQualityScore_(r.readLength);
    }
  }

  async decodeFeature_(r) {
    var f = new Map();
    var byte = await this.readItem_("FC", "Byte");
    f.set("FC", String.fromCharCode.apply("", new Uint8Array(byte)));
    f.set("FP", await this.readItem_("FP", "Int"));
    if (f.get("FC") == "B") {
      f.set("BA", await this.readItem_("BA", "Byte"));
      f.set("QS", await this.readItem_("QS", "Byte"));
    } else if (f.get("FC") == "X") {
      f.set("BS", await this.readItem_("BS", "Byte"));
    } else if (f.get("FC") == "I") {
      f.set("IN", await this.readItem_("IN", "ByteArray"));
    } else if (f.get("FC") == "S") {
      f.set("SC", await this.readItem_("SC", "ByteArray"));
    } else if (f.get("FC") == "H") {
      f.set("HC", await this.readItem_("HC", "Int"));
    } else if (f.get("FC") == "P") {
      f.set("PD", await this.readItem_("PD", "Int"));
    } else if (f.get("FC") == "D") {
      f.set("DL", await this.readItem_("DL", "Int"));
    } else if (f.get("FC") == "N") {
      f.set("RS", await this.readItem_("RS", "Int"));
    } else if (f.get("FC") == "i") {
      f.set("BA", await this.readItem_("BA", "Byte"));
    } else if (f.get("FC") == "b") {
      f.set("BB", await this.readItem_("BB", "ByteArray"));
    } else if (f.get("FC") == "q") {
      f.set("QQ", await this.readItem_("QQ", "ByteArray"));
    } else if (f.get("FC") == "Q") {
      f.set("QS", await this.readItem_("QS", "Byte"));
    }
    r.pushFeature(f);
  }

  async decodeUnmappedRead_(r) {
    b = new Array(r.readLength);
    for (var i = 0; i < r.readLength; i++) {
      b[i] = await this.readItem_("BA", "Byte");
    }
    r.base = b;
    var header = await this.container_.loadCompressionHeaderBlock();
    if (header.get("content").get("dse").has("QS")) {
      r.qualityScore = await this.readQualityScore_(r.readLength);
    }
  }

  async readQualityScore_(readLength) {
    var qs = new Array(readLength);
    for (var i = 0; i < readLength; i++) {
      var int = await this.readItem_("QS", "Int");
      qs[i] = int + 33; // +33 to match chr with samtools
    }
    return String.fromCharCode.apply("", qs);
  }

  decodeTotalMateData_(records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if ((r.getCf() & 4) == 4) {
        // mate is downstream
        var n = records[i + r.nextFrag + 1]; // n is next_fragment
        if ((n.getBf() & 0x10) == 0x10) {
          r.setBf(r.getBf() | 0x20);
        }
        if ((n.getBf() & 0x04) == 0x04) {
          r.setBf(r.getBf() | 0x08);
        }
        // read name of mate record
        r.mateReadName = n.readName;
        n.mateReadName = r.readName;
        // Resolve mate_ref_id for this record and this + next_frag onece both have been decoded
        r.mateRefId = n.refSeqId;
        n.mateRefId = r.refSeqId;
        // Resolve mate_position for this record and this + next_frag once both have been decoded
        r.matePos = n.position;
        n.matePos = r.position;
        // Find leftmost and rightmost mapped coordinate in records this and this + next_frag
        if (r.refSeqId != n.refSeqId) {
          r.templateSize = 0;
          n.templateSize = 0;
          return;
        }
        var rmb =
          r.readLength - (r.hasSoftclip() ? r.features.get("S").length : 0); // mapped bases
        var nmb =
          n.readLength - (n.hasSoftclip() ? n.features.get("S").length : 0); // mapped bases
        var l = [
          r.position,
          r.position + ((r.getBf() & 0x10) != 0x10 ? rmb - 1 : -rmb + 1),
          n.position,
          n.position - ((n.getBf() & 0x10) != 0x10 ? nmb - 1 : -nmb + 1),
        ];
        var leftmost = Math.min(...l);
        var rightmost = Math.max(...l);
        var lm = l.indexOf(leftmost) < 2 ? r : n;
        var rm = l.indexOf(rightmost) < 2 ? r : n;
        // For leftmost of this and this + next_frag record: template_size <- rightmost - leftmost + 1
        lm.templateSize = rightmost - leftmost + 1;
        // For rightmost of this and this + next_frag record: template_size <- -(rightmost - leftmost + 1)
        rm.templateSize = -(rightmost - leftmost + 1);
      }
    }
  }
}
