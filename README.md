# cram-reader-js

This is a cram file handling module to make [KERO-browse](https://github.com/DBKERO/genome_browser) cram-compatible.

## Usage

```js
// Source the cram-reader-js.min.js first.

// For local file
// cram, crai, fa and fai are File objects (https://developer.mozilla.org/docs/Web/API/File).
// Form tag in html gives this type of object.
var cram = File(bits, name);
var crai = File(bits, name);
var fa = File(bits, name);
var fai = File(bits, name);
var is_local_file = true;

// For remote file
var cram = "https://your.cram.file";
var crai = "https://your.crai.file";
var fa = "https://your.fa.file";
var fai = "https://your.fai.file";
var is_local_file = false;

// Set range
var chr = "chr22";
var start = 50199000;
var end = 50200000;

// Open files and run
var c = new CramReader(cram, crai, is_local_file, fa, fai);
c.setOnerror(onerrfunc);
c.getRecords(chr, start, end, callbackfunc);

// CRAM file can be read without fa file.
// In this situation, sequence is not defined.
var c = new CramReader(cram, crai, is_local_file);
c.setOnerror(onerrfunc);
c.getRecords(chr, start, end, callbackfunc);
```

See demo.html and demo.js for detail.
