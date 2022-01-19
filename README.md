# cram-reader-js

This is a cram file handling module to make [KERO-browse](https://github.com/DBKERO/genome_browser) cram-compatible.

## Usage

```js
// For local file
// cram and crai are File objects (https://developer.mozilla.org/docs/Web/API/File), and form tag in html gives this type of object.
var cram = File(bits, name);
var crai = File(bits, name);
var is_local_file = true;

// For remote file
var cram = "https://your.cram.file";
var crai = "https://your.crai.file";
var is_local_file = false;

// Set range
var chr = "chr22";
var start = 50199000;
var end = 50200000;

// Open files and run
var c = new Cram(cram, crai, is_local_file);
c.getRecords(chr, start, end)
  .then((reads) => {
    reads.forEach((r) => {
      console.log(r);
      console.log(r.toSAMString());
    });
  })

```
