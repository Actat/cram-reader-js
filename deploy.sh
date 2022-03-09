#!/bin/sh

touch cram-reader-js.min.js
rm cram-reader-js.min.js

# concat source
cat src/bitsIo.js > cram-reader-js.js
cat src/cram.js >> cram-reader-js.js
cat src/cramContainer.js >> cram-reader-js.js
cat src/cramDataContainer.js >> cram-reader-js.js
cat src/cramHeader.js >> cram-reader-js.js
cat src/cramRans.js >> cram-reader-js.js
cat src/cramRecord.js >> cram-reader-js.js
cat src/cramSlice.js >> cram-reader-js.js
cat src/cramStream.js >> cram-reader-js.js
cat src/fileHandler.js >> cram-reader-js.js
cat src/fasta.js >> cram-reader-js.js

# minify with terser v5.12.0
terser cram-reader-js.js --ecma 8 --mangle --mangle-props regex=/_$/,reserved=[getRecords,toSAMString,bf_,cf_,cigar,features_,mappingQuality,matePos,mateReadName,mateRefId,position,qualityScore,readGroup,readLength,readName,refSeqId,refSeqName,seq,tags,templateSize] > cram-reader-js.min.js

rm cram-reader-js.js

# combine gunzip.min.js
cat gunzip.min.js >> cram-reader-js.min.js