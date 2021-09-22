class CramRecord{
    constructor(bf, cf) {
        this.bf = bf;
        this.cf = cf;
        this.features = new Array();
    }

    hasSoftclip() {
        this.features.forEach(map => {
            if (map.get('FC') == 'S') {
                return true;
            }
        });
        return false;
    }

    restoreCigar() {
        if('cigar' in this || !('readLength' in this)) {
            return;
        } else if (this.features.length == 0) {
            this.cigar = String(this.readLength) + "M";
            return;
        } else {
            var cigar = "";
            var cigarLn = [];
            var cigarOp = [""];
            var lastOp = "";
            var lastOpLen = 0;
            var lastOpPos = 1;
            this.features.forEach(feature => {
                var gap = feature.get('FP') - (lastOpPos + lastOpLen);
                if (gap > 0) {
                    if (lastOp == 'M') {
                        cigarLn[cigarLn.length - 1] += gap;
                    } else {
                        cigarLn.push(gap);
                        cigarOp.push('M');
                        lastOp = 'M';
                    }
                }
                switch (feature.get("FC")) {
                    case 'X':
                        lastOpLen = 1;
                        lastOpPos = feature.get("FP");
                        lastOp = "M";
                        if (lastOp == "M") {
                            cigarLn[cigarLn.length - 1]++
                        } else {
                            cigarLn.push(1);
                            cigarOp.push("M");
                        }
                        break;
                    case "S":
                        lastOpLen = feature.get("SC").length;
                        lastOpPos = feature.get("FP");
                        lastOp = "S";
                        cigarLn.push(lastOpLen);
                        cigarOp.push("S");
                        break;
                    case "i":
                        lastOpLen = 1;
                        lastOpPos = feature.get("FP");
                        lastOp = "I";
                        cigarLn.push(1);
                        cigarOp.push("I")
                        break;
                    case "I":
                        lastOpLen = 1;
                        lastOpPos = feature.get("FP");
                        lastOp = "I";
                        cigarLn.push(feature.get("IN").length);
                        cigarOp.push("I");
                        break;
                    case "D":
                        lastOpLen = 0;
                        lastOpPos = feature.get("FP");
                        lastOp = feature.get("FC");
                        cigarLn.push(feature.get("DL"));
                        cigarOp.push(feature.get("FC"));
                        break;
                    case "N":
                        lastOpLen = 0;
                        lastOpPos = feature.get("FP");
                        lastOp = feature.get("FC");
                        cigarLn.push(feature.get("RS"));
                        cigarOp.push(feature.get("FC"));
                        break;
                    case "P":
                        lastOpLen = 0;
                        lastOpPos = feature.get("FP");
                        lastOp = feature.get("FC");
                        cigarLn.push(feature.get("PD"));
                        cigarOp.push(feature.get("FC"));
                        break;
                    case "H":
                        lastOpLen = 0;
                        lastOpPos = feature.get("FP");
                        lastOp = feature.get("FC");
                        cigarLn.push(feature.get("HC"));
                        cigarOp.push(feature.get("FC"));
                        break;
                }
            });
            if (lastOpPos + lastOpLen - 1 < this.readLength) {
                if (lastOp == "M") {
                    cigarLn[cigarLn.length - 1] += this.readLength - (lastOpPos + lastOpLen - 1);
                } else {
                    cigarLn.push(this.readLength - (lastOpPos + lastOpLen - 1));
                    cigarOp.push("M")
                }
            }
            for (var i = 0; i < cigarLn.length; i++) {
                cigar += String(cigarLn[i]) + cigarOp[i + 1];
            }
            this.cigar = cigar;
            return;
        }
    }
}