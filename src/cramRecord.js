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
    var refLen = this.readLength;
    this.features_.forEach((feature) => {
      var fc = feature.get("FC");
      if (fc == "I") {
        refLen -= feature.get("IN").length;
      }
      if (fc == "i") {
        refLen -= 1;
      }
      if (fc == "S") {
        console.log(feature);
        refLen -= feature.get("SC").length;
      }
      if (fc == "D") {
        refLen += feature.get("DL");
      }
      if (fc == "N") {
        refLen += feature.get("RS");
      }
    });
    return fasta
      .laodSequence(this.refSeqName, this.position - 1, refLen)
      .then((ref) => {
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

            case "D":
              var dl = feature.get("DL");
              var a = ref.slice(0, fp - 1);
              var b = ref.slice(fp - 1 + dl);
              ref = a + b;
              break;

            case "N":
              var rs = feature.get("RS");
              var a = ref.slice(0, fp - 1);
              var b = ref.slice(fp - 1 + rs);
              ref = a + b;
              break;

            case "X":
              var base = ref.slice(fp - 1, fp);
              var index = "ACGTN".indexOf(base);
              var subst_matrix = new Uint8Array(feature.get("SM"));
              var subst_code = subst_matrix.slice(index, index + 1)[0];
              var destination = "ACGTN".replace(base, "");
              var bs = new Uint8Array(feature.get("BS"))[0];
              console.log(
                base,
                index,
                subst_matrix,
                subst_code,
                destination,
                bs
              );
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
        this.seq = ref;
      });
  }
}
