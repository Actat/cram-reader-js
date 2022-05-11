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
    } else if (this.features_.length == 0) {
      this.cigar = String(this.readLength) + "M";
      return;
    } else {
      var cigarLn = [];
      var cigarOp = [""];
      var lastOp = "";
      var last_pos = 0;
      var last_op_len = 0;
      this.features_.forEach((feature) => {
        var fp = feature.get("FP");
        if (fp > 1) {
          if (lastOp == "M") {
            cigarLn[cigarLn.length - 1] += fp - 1;
          } else {
            cigarLn.push(fp - 1);
            cigarOp.push("M");
            lastOp = "M";
          }
        }
        switch (feature.get("FC")) {
          case "X":
            last_op_len = 1;
            lastOp = "M";
            if (lastOp == "M") {
              cigarLn[cigarLn.length - 1]++;
            } else {
              cigarLn.push(1);
              cigarOp.push("M");
            }
            break;
          case "S":
            last_op_len = feature.get("SC").length;
            lastOp = "S";
            cigarLn.push(last_op_len);
            cigarOp.push("S");
            break;
          case "i":
            last_op_len = 1;
            lastOp = "I";
            cigarLn.push(1);
            cigarOp.push("I");
            break;
          case "I":
            last_op_len = feature.get("IN").length;
            lastOp = "I";
            cigarLn.push(feature.get("IN").length);
            cigarOp.push("I");
            break;
          case "D":
            last_op_len = 0;
            lastOp = feature.get("FC");
            cigarLn.push(feature.get("DL"));
            cigarOp.push(feature.get("FC"));
            break;
          case "N":
            last_op_len = 0;
            lastOp = feature.get("FC");
            cigarLn.push(feature.get("RS"));
            cigarOp.push(feature.get("FC"));
            break;
          case "P":
            last_op_len = 0;
            lastOp = feature.get("FC");
            cigarLn.push(feature.get("PD"));
            cigarOp.push(feature.get("FC"));
            break;
          case "H":
            last_op_len = 0;
            lastOp = feature.get("FC");
            cigarLn.push(feature.get("HC"));
            cigarOp.push(feature.get("FC"));
            break;
        }
        last_pos = last_pos + fp + last_op_len - 1;
      });
      if (last_pos < this.readLength) {
        if (lastOp == "M") {
          cigarLn[cigarLn.length - 1] += this.readLength - last_pos;
        } else {
          cigarLn.push(this.readLength - last_pos);
          cigarOp.push("M");
        }
      }

      var cigar = "";
      for (var i = 0; i < cigarLn.length; i++) {
        cigar += String(cigarLn[i]) + cigarOp[i + 1];
      }
      this.cigar = cigar;
      return;
    }
  }

  restoreSequence(fasta) {
    var ref_fragments = [];
    var fragment_start_pos = this.position;
    var fragment_length = 0;
    var insert_length = 0;
    for (var i = 0; i < this.features_.length + 1; i++) {
      var fc = "";
      if (i < this.features_.length) {
        fc = this.features_[i].get("FC");
        var fp = this.features_[i].get("FP");
        fragment_length += fp - 1;
      }
      if (fc == "I") {
        var in_l = this.features_[i].get("IN").length;
        insert_length += in_l;
        continue;
      }
      if (fc == "i") {
        insert_length++;
        continue;
      }
      if (fc == "S") {
        var sc_l = this.features_[i].get("SC").length;
        insert_length += sc_l;
        continue;
      }
      if (fc == "D" || fc == "N" || i == this.features_.length) {
        ref_fragments.push(
          fasta.loadSequence(
            this.refSeqName,
            fragment_start_pos,
            fragment_start_pos + fragment_length - 1
          )
        );
        var skip_length;
        if (fc == "D") {
          skip_length = this.features_[i].get("DL");
        }
        if (fc == "N") {
          skip_length = this.features_[i].get("RS");
        }
        fragment_start_pos += fragment_lenght + insert_length + skip_length - 1;
        insert_length = 0;
      }
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
            var a = ref.slice(last_pos, fp - 1);
            var b = ref.slice(fp - 1);
            var str = String.fromCharCode.apply(
              "",
              new Uint8Array(feature.get("IN"))
            );
            ref = a + str + b;
            last_pos += fp + str.length;
            break;

          case "i":
            var a = ref.slice(last_pos, fp - 1);
            var b = ref.slice(fp - 1);
            var str = String.fromCharCode.apply(
              "",
              new Uint8Array(feature.get("BA"))
            );
            ref = a + str + b;
            last_pos += fp + 1;
            break;

          case "S":
            var a = ref.slice(last_pos, fp - 1);
            var b = ref.slice(fp - 1);
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
            var a = ref.slice(0, fp - 1);
            var b = ref.slice(fp);
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
