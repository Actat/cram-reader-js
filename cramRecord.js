class CramRecord{
    constructor(bf, cf) {
        this.bf = bf;
        this.cf = cf;
        this.features = new Map();
    }

    hasSoftclip() {
        return self.features.has('S');
    }
}