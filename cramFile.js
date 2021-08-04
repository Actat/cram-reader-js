// import cramRans
// import gzip

class CramFile {

    constructor(arrayBuffer) {
        this.arrayBuffer = arrayBuffer;
        this.index = 0;
    }

    readInt8(f) {
        return int.from_bytes(f.read(1), byteorder='little', signed=True)
    }

    readUint8(f) {
        return int.from_bytes(f.read(1), byteorder='little', signed=False)
    }

    readInt16(f) {
        return int.from_bytes(f.read(2), byteorder='little', signed=True)
    }

    readUint16(f) {
        return int.from_bytes(f.read(2), byteorder='little', signed=False)
    }

    readInt32(f) {
        return int.from_bytes(f.read(4), byteorder='little', signed=True)
    }

    readUint32(f) {
        return int.from_bytes(f.read(4), byteorder='little', signed=False)
    }

    readInt64(f) {
        return int.from_bytes(f.read(8), byteorder='little', signed=True)
    }

    readBoolean(f) {
        return f.read(1) == bytes([1])
    }

    readItf8(f) {
        firstByte = f.read(1)
        if (firstByte[0] >> 7 == 0b0) {
            return firstByte[0] & 0b01111111
        } else if (firstByte[0] >> 6 == 0b10) {
            return ((firstByte[0] & 0b00111111) << 8) | int.from_bytes(f.read(1), byteorder='big')
        } else if (firstByte[0] >> 5 == 0b110) {
            return ((firstByte[0] & 0b00011111) << 16) | int.from_bytes(f.read(2), byteorder='big')
        } else if (firstByte[0] >> 4 == 0b1110) {
            return ((firstByte[0] & 0b00001111) << 24) | int.from_bytes(f.read(3), byteorder='big')
        } else {
            num = ((firstByte[0] & 0b00001111) << 28) | (int.from_bytes(f.read(3), byteorder='big') << 4) | (f.read(1)[0] & 0b00001111)
            if (num < 2 ** 31) {
                return num
            } else {
                return num - 2 ** 32
            }
        }
    }

    readLtf8(f) {
        firstByte = f.read(1)

        if (firstByte[0] >> 7 == 0b0) {
            return firstByte[0] & 0b01111111
        } else if (firstByte[0] >> 6 == 0b10) {
            return ((firstByte[0] & 0b00111111) << 8) | int.from_bytes(f.read(1), byteorder='big')
        } else if (firstByte[0] >> 5 == 0b110) {
            return ((firstByte[0] & 0b00011111) << 16) | int.from_bytes(f.read(2), byteorder='big')
        } else if (firstByte[0] >> 4 == 0b1110) {
            return ((firstByte[0] & 0b00001111) << 24) | int.from_bytes(f.read(3), byteorder='big')
        } else if (firstByte[0] >> 3 == 0b11110) {
            return ((firstByte[0] & 0b00000111) << 32) | int.from_bytes(f.read(4), byteorder='big')
        } else if (firstByte[0] >> 2 == 0b111110) {
            return ((firstByte[0] & 0b00000011) << 40) | int.from_bytes(f.read(5), byteorder='big')
        } else if (firstByte[0] >> 1 == 0b1111110) {
            return ((firstByte[0] & 0b00000001) << 48) | int.from_bytes(f.read(6), byteorder='big')
        } else if (firstByte[0] == 0b11111110) {
            return int.from_bytes(f.read(7), byteorder='big')
        } else {
            num = int.from_bytes(f.read(8), byteorder='big')
            if (num < 2 ** 63) {
                return num
            } else {
                return num - 2 ** 64
            }
        }
    }

    readArrayItf8(f) {
        result = list()
        for (var i = 0; i < readItf8(f); i++) {
            result.append(readItf8(f))
        }
        return result
    }

    readArrayByte(f) {
        result = list()
        for (var i = 0; i < readItf8(f); i++) {
            result.append(f.read(1))
        }
        return result
    }

    readEncodingInt(f) {
        codecId = readItf8(f)
        numberOfBytesToFollow = readItf8(f)
        if (codecId == 1) {
            // console.log('EXTERNAL: codec ID 1')
            return {
                'codecId' : 1,
                'externalId' : readItf8(f)
            }
        } else if (codecId == 3) {
            // console.log('Huffman coding: codec ID 3')
            return {
                'codecId' : 3,
                'alphabet' : readArrayItf8(f),
                'bit-length' : readArrayItf8(f)
            }
        } else if (codecId == 6) {
            // console.log('Beta coding: codec ID 6')
            return {
                'codecId' : 6,
                'offset' : readItf8(f),
                'length' : readItf8(f)
            }
        } else if (codecId == 7) {
            // console.log('Subexponential coding: codec ID 7')
            return {
                'codecId' : 7,
                'offset' : readItf8(f),
                'k' : readItf8(f)
            }
        } else if (codecId == 9) {
            // console.log('Gamma coding: codec ID 9')
            return {
                'codecId' : 9,
                'offset' : readItf8(f)
            }
        } else {
            console.log('Error: invalid codec ID')
            return {}
        }
    }

    readEncodingByte(f) {
        codecId = readItf8(f)
        numberOfBytesToFollow = readItf8(f)
        if (codecId == 1) {
            // console.log('EXTERNAL: codec ID 1')
            return {
                'codecId' : 1,
                'externalId' : readItf8(f)
            }
        } else if (codecId == 3) {
            // console.log('Huffman coding: codec ID 3')
            return {
                'codecId' : 3,
                'alphabet' : readArrayItf8(f),
                'bit-length' : readArrayItf8(f)
            }
        } else {
            console.log('Error: invalid codec ID')
            return {}
        }
    }

    readEncodingByteArray(f) {
        codecId = readItf8(f)
        numberOfBytesToFollow = readItf8(f)
        if (codecId == 4) {
            // console.log('BYTE_ARRAY_LEN: codec ID 4')
            return {
                'codecId' : 4,
                'lengthsEncoding' : readEncodingInt(f),
                'valuesEncoding' : readEncodingByte(f)
            }
        } else if (codecId == 5) {
            // console.log('BYTE_ARRAY_STOP: codec ID 5')
            return {
                'codecId' : 5,
                'stopByte' : f.read(1),
                'externalId' : readItf8(f)
            }
        } else {
            console.log('Error: invalid codec ID')
            return {}
        }
    }

    readBlock(f, pos = -1) {
        result = {}
        if (pos >= 0) {
            f.seek(pos)
            p = pos
        } else {
            p = f.tell()
        }
        result["method"] = int.from_bytes(f.read(1), byteorder='big')
        result["contentTypeId"] = int.from_bytes(f.read(1), byteorder='big')
        result["contentId"] = readItf8(f)
        result["size"] = readItf8(f)
        result["rawSize"] = readItf8(f)
        data = f.read(result["size"])
        if (result["method"] == 0) {
            // raw
            result["data"] = data
        } else if (result["method"] == 1) {
            // gzip
            result["data"] = gzip.decompress(data)
        } else if (result["method"] == 2) {
            // bzip2
            console.log("bzip2 is not supported (contentTypeId: " + str(result.get("contentTypeId")) + ", contentId: " + str(result.get("contentId")) + ")")
            //result["data"] = data
        } else if (result["method"] == 3) {
            // lzma
            console.log("lzma is not supported (contentTypeId: " + str(result.get("contentTypeId")) + ", contentId: " + str(result.get("contentId")) + ")")
            //result["data"] = data
        } else if (result["method"] == 4) {
            // rans
            result["data"] = cramRans.ransDecode(data)
        }
        result['CRC32'] = f.read(4)
        result['blockSize'] = f.tell() - p
        return result
    }
}
