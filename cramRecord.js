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
        if('cigar' in this) {
            return;
        } else if (this.features.size == 0) {
            this.cigar = String(this.readLength) + "M";
            return;
        } else {
            // under construction
            return;
        }
    }
}