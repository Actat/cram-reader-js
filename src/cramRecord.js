class CramRecord {
  constructor(bf, cf) {
    this.bf_ = bf;
    this.cf_ = cf;
    this.features_ = new Array();
  }

  getBf() {
    return this.bf_;
  }

  getCf() {
    return this.cf_;
  }

  setBf(bf) {
    this.bf_ = bf;
  }

  pushFeature(feature) {
    this.features_.push(feature);
  }

  toSAMString() {
    var str = new String();
    str += this.readName === undefined ? "" : this.readName;
    str += "\t" + (this.bf_ === undefined ? "" : this.bf_);
    str += "\t" + (this.refSeqName === undefined ? "" : this.refSeqName);
    str += "\t" + (this.position === undefined ? "" : this.position);
    str +=
      "\t" + (this.mappingQuality === undefined ? "" : this.mappingQuality);
    str += "\t" + (this.cigar === undefined ? "" : this.cigar);
    str += "\t" + (this.mateReadName === undefined ? "" : this.mateReadName);
    str += "\t" + (this.matePos === undefined ? "" : this.matePos);
    str += "\t" + (this.templateSize === undefined ? "" : this.templateSize);
    str += "\t" + (this.seq === undefined ? "" : this.seq) + "\t";
    str += "\t" + (this.qualityScore === undefined ? "" : this.qualityScore);
    str += "\t" + (this.tags === undefined ? "" : JSON.stringify(this.tags));
    return str;
  }

  hasSoftclip() {
    this.features_.forEach((map) => {
      if (map.get("FC") == "S") {
        return true;
      }
    });
    return false;
  }

  restoreCigar() {
    if ("cigar" in this || !("readLength" in this)) {
      return;
    }
    var cigar = "";
    var cigarLn = [];
    var cigarOp = [""];
    var feature_pos_on_seq = 0;
    var length_on_seq = 0;
    var length_on_ref = 0;
    this.features_.forEach((feature) => {
      var fp = feature.get("FP");
      var fc = feature.get("FC");
      feature_pos_on_seq += fp;
      if (fp > 1) {
        var gap = feature_pos_on_seq - length_on_seq - 1;
        if (cigarOp[cigarOp.length - 1] == "M") {
          cigarLn[cigarLn.length - 1] += gap;
        } else {
          cigarLn.push(gap);
          cigarOp.push("M");
        }
        length_on_seq += gap;
        length_on_ref += gap;
      }
      switch (fc) {
        case "X":
          if (cigarOp[cigarOp.length - 1] == "M") {
            cigarLn[cigarLn.length - 1]++;
          } else {
            cigarLn.push(1);
            cigarOp.push("M");
          }
          length_on_seq++;
          length_on_ref++;
          break;
        case "S":
          var len = feature.get("SC").length;
          cigarLn.push(len);
          cigarOp.push("S");
          length_on_seq += len;
          break;
        case "i":
          cigarLn.push(1);
          cigarOp.push("I");
          length_on_seq++;
          break;
        case "I":
          var len = feature.get("IN").length;
          cigarLn.push(len);
          cigarOp.push("I");
          length_on_seq += len;
          break;
        case "D":
          var len = feature.get("DL");
          cigarLn.push(len);
          cigarOp.push(feature.get("FC"));
          length_on_ref += len;
          break;
        case "N":
          var len = feature.get("RS");
          cigarLn.push(len);
          cigarOp.push(feature.get("FC"));
          length_on_ref += len;
          break;
        case "P":
          var len = feature.get("PD");
          cigarLn.push(len);
          cigarOp.push(feature.get("FC"));
          length_on_ref += len;
          break;
        case "H":
          cigarLn.push(feature.get("HC"));
          cigarOp.push(feature.get("FC"));
          break;
      }
    });
    if (length_on_seq < this.readLength) {
      var len = this.readLength - length_on_seq;
      length_on_seq += len;
      length_on_ref += len;
      if (cigarOp[cigarOp.length - 1] == "M") {
        cigarLn[cigarLn.length - 1] += len;
      } else {
        cigarLn.push(len);
        cigarOp.push("M");
      }
    }
    for (var i = 0; i < cigarLn.length; i++) {
      cigar += String(cigarLn[i]) + cigarOp[i + 1];
    }
    this.cigar = cigar;
    this.cigarLn = cigarLn;
    this.cigarOp = cigarOp;
    this.length_on_ref = length_on_ref;
    this.positionEnd = this.position + length_on_ref - 1;
    return;
  }

  restoreSequence(fasta) {
    var ref_fragments = [];
    var fragment_start_pos = this.position;
    var fragment_length = 0;
    var insert_length = 0;
    var last_pos = 0;
    for (var i = 0; i < this.features_.length; i++) {
      var fc = this.features_[i].get("FC");
      var fp = this.features_[i].get("FP");
      last_pos += fp - 1;
      fragment_length += fp - 1;
      if (fc == "X") {
        fragment_length++;
        last_pos++;
        continue;
      }
      if (fc == "I") {
        var in_l = this.features_[i].get("IN").length;
        insert_length += in_l;
        last_pos += in_l;
        continue;
      }
      if (fc == "i") {
        insert_length++;
        last_pos++;
        continue;
      }
      if (fc == "S") {
        var sc_l = this.features_[i].get("SC").length;
        insert_length += sc_l;
        last_pos += sc_l;
        continue;
      }
      if (fc == "D" || fc == "N") {
        if (fragment_length > 0) {
          ref_fragments.push(
            fasta.loadSequence(
              this.refSeqName,
              fragment_start_pos,
              fragment_start_pos + fragment_length - 1
            )
          );
        }
        var skip_length;
        if (fc == "D") {
          skip_length = this.features_[i].get("DL");
        }
        if (fc == "N") {
          skip_length = this.features_[i].get("RS");
        }
        fragment_start_pos += fragment_length + insert_length + skip_length;
        insert_length = 0;
        fragment_length = 0;
      }
    }
    if (fragment_length > 0 || last_pos < this.readLength) {
      ref_fragments.push(
        fasta.loadSequence(
          this.refSeqName,
          fragment_start_pos,
          fragment_start_pos +
            fragment_length +
            (this.readLength - last_pos) -
            1
        )
      );
    }

    return Promise.all(ref_fragments).then((fragments) => {
      var ref = "";
      fragments.forEach((fragment) => {
        ref = ref.concat(fragment);
      });

      var last_pos = 0;
      this.features_.forEach((feature) => {
        var fp = feature.get("FP");
        switch (feature.get("FC")) {
          case "I":
            var a = ref.slice(0, last_pos + fp - 1);
            var b = ref.slice(last_pos + fp - 1);
            var str = String.fromCharCode.apply(
              "",
              new Uint8Array(feature.get("IN"))
            );
            ref = a + str + b;
            last_pos += fp + str.length;
            break;

          case "i":
            var a = ref.slice(0, last_pos + fp - 1);
            var b = ref.slice(last_pos + fp - 1);
            var str = String.fromCharCode.apply(
              "",
              new Uint8Array(feature.get("BA"))
            );
            ref = a + str + b;
            last_pos += fp + 1;
            break;

          case "S":
            var a = ref.slice(0, last_pos + fp - 1);
            var b = ref.slice(last_pos + fp - 1);
            var str = String.fromCharCode.apply(
              "",
              new Uint8Array(feature.get("SC"))
            );
            ref = a + str + b;
            last_pos += fp + str.length;
            break;

          case "X":
            var base = ref
              .slice(last_pos + fp - 1, last_pos + fp)
              .toUpperCase();
            var index = "ACGTN".indexOf(base);
            var subst_matrix = new Uint8Array(feature.get("SM"));
            var subst_code = subst_matrix.slice(index, index + 1)[0];
            var destination = "ACGTN".replace(base, "");
            var bs = new Uint8Array(feature.get("BS"))[0];
            var sub = "x";
            for (var i = 0; i < 4; i++) {
              if (((subst_code >> (2 * (3 - i))) & 0b11) == bs) {
                sub = destination.charAt(i);
              }
            }
            var a = ref.slice(0, last_pos + fp - 1);
            var b = ref.slice(last_pos + fp);
            ref = a + sub + b;
            last_pos += fp;
            break;

          default:
            break;
        }
      });
      this.seq = ref.toUpperCase();
      return this.seq;
    });
  }
}
