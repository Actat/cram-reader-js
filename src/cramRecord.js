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
    this.sortFeatures_();
    if ("cigar" in this || !("readLength" in this)) {
      return;
    } else if (this.features_.length == 0) {
      this.cigar = String(this.readLength) + "M";
      return;
    } else {
      var cigar = "";
      var cigarLn = [];
      var cigarOp = [""];
      var lastOp = "";
      var lastOpLen = 0;
      var lastOpPos = 1;
      this.features_.forEach((feature) => {
        var gap = feature.get("FP") - (lastOpPos + lastOpLen);
        if (gap > 0) {
          if (lastOp == "M") {
            cigarLn[cigarLn.length - 1] += gap;
          } else {
            cigarLn.push(gap);
            cigarOp.push("M");
            lastOp = "M";
          }
        }
        lastOpPos = feature.get("FP");
        switch (feature.get("FC")) {
          case "X":
            lastOpLen = 1;
            lastOp = "M";
            if (lastOp == "M") {
              cigarLn[cigarLn.length - 1]++;
            } else {
              cigarLn.push(1);
              cigarOp.push("M");
            }
            break;
          case "S":
            lastOpLen = feature.get("SC").length;
            lastOp = "S";
            cigarLn.push(lastOpLen);
            cigarOp.push("S");
            break;
          case "i":
            lastOpLen = 1;
            lastOp = "I";
            cigarLn.push(1);
            cigarOp.push("I");
            break;
          case "I":
            lastOpLen = feature.get("IN").length;
            lastOp = "I";
            cigarLn.push(feature.get("IN").length);
            cigarOp.push("I");
            break;
          case "D":
            lastOpLen = 0;
            lastOp = feature.get("FC");
            cigarLn.push(feature.get("DL"));
            cigarOp.push(feature.get("FC"));
            break;
          case "N":
            lastOpLen = 0;
            lastOp = feature.get("FC");
            cigarLn.push(feature.get("RS"));
            cigarOp.push(feature.get("FC"));
            break;
          case "P":
            lastOpLen = 0;
            lastOp = feature.get("FC");
            cigarLn.push(feature.get("PD"));
            cigarOp.push(feature.get("FC"));
            break;
          case "H":
            lastOpLen = 0;
            lastOp = feature.get("FC");
            cigarLn.push(feature.get("HC"));
            cigarOp.push(feature.get("FC"));
            break;
        }
      });
      if (lastOpPos + lastOpLen - 1 < this.readLength) {
        if (lastOp == "M") {
          cigarLn[cigarLn.length - 1] +=
            this.readLength - (lastOpPos + lastOpLen - 1);
        } else {
          cigarLn.push(this.readLength - (lastOpPos + lastOpLen - 1));
          cigarOp.push("M");
        }
      }
      for (var i = 0; i < cigarLn.length; i++) {
        cigar += String(cigarLn[i]) + cigarOp[i + 1];
      }
      this.cigar = cigar;
      return;
    }
  }

  sortFeatures_() {
    this.features_.sort((a, b) => {
      return a.get("FP") - b.get("FP");
    });
  }

  restoreSequence(fasta) {
    this.sortFeatures_();
    var ref_fragments = [];
    var fp_offset = 0;
    var ref_end_pos = this.position + this.readLength - 1;
    var fragment_start_pos = this.position;
    for (var i = 0; i < this.features_.length + 1; i++) {
      var fc = "";
      var fragment_end_pos = ref_end_pos;
      if (i < this.features_.length) {
        fc = this.features_[i].get("FC");
        var fp = this.features_[i].get("FP");
        fragment_end_pos = this.position + (fp - 1) + fp_offset - 1;
      }
      if (fc == "I") {
        var in_l = this.features_[i].get("IN").length;
        ref_end_pos -= in_l;
        fp_offset -= in_l;
        continue;
      }
      if (fc == "i") {
        ref_end_pos--;
        fp_offset--;
        continue;
      }
      if (fc == "S") {
        var sc_l = this.features_[i].get("SC").length;
        ref_end_pos -= sc_l;
        fp_offset -= sc_l;
        continue;
      }
      if (fc == "D" || fc == "N" || i == this.features_.length) {
        ref_fragments.push(
          fasta.loadSequence(
            this.refSeqName,
            fragment_start_pos,
            fragment_end_pos
          )
        );
        var skip_length;
        if (fc == "D") {
          skip_length = this.features_[i].get("DL");
        }
        if (fc == "N") {
          skip_length = this.features_[i].get("RS");
        }
        fragment_start_pos = fragment_end_pos + skip_length + 1;
        ref_end_pos += skip_length;
      }
    }
    return Promise.all(ref_fragments).then((fragments) => {
      var ref = "";
      fragments.forEach((fragment) => {
        ref = ref.concat(fragment);
      });
      this.features_.forEach((feature) => {
        var fp = feature.get("FP");
        switch (feature.get("FC")) {
          case "I":
            var a = ref.slice(0, fp - 1);
            var b = ref.slice(fp - 1);
            var str = String.fromCharCode.apply(
              "",
              new Uint8Array(feature.get("IN"))
            );
            ref = a + str + b;
            break;

          case "i":
            var a = ref.slice(0, fp - 1);
            var b = ref.slice(fp - 1);
            var str = String.fromCharCode.apply(
              "",
              new Uint8Array(feature.get("BA"))
            );
            ref = a + str + b;
            break;

          case "S":
            var a = ref.slice(0, fp - 1);
            var b = ref.slice(fp - 1);
            var str = String.fromCharCode.apply(
              "",
              new Uint8Array(feature.get("SC"))
            );
            ref = a + str + b;
            break;

          case "X":
            var base = ref.slice(fp - 1, fp).toUpperCase();
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
