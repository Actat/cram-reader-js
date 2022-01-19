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
}
