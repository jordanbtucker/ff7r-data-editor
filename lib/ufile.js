const {readFile, writeFile} = require('fs/promises')

/**
 * @typedef IUFile
 * @property {string} filename
 * @property {number[]} data
 */

class UFile {
  /**
   * @param {string} filename
   */
  constructor(filename) {
    this.filename = filename
  }

  async read() {
    this.data = await readFile(this.filename)
    this.pos = 0
  }

  readBoolean() {
    return this.readByte() !== 0
  }

  readByte() {
    return this.data[this.pos++]
  }

  /**
   * @param {number} n
   */
  readBytes(n) {
    const value = this.data.slice(this.pos, this.pos + n)
    this.pos += n
    return value
  }

  readInt16() {
    const value = this.data.readInt16LE(this.pos)
    this.pos += 2
    return value
  }

  readInt32() {
    const value = this.data.readInt32LE(this.pos)
    this.pos += 4
    return value
  }

  readInt64() {
    const value = this.data.readBigInt64LE(this.pos)
    this.pos += 8
    return value
  }

  readUInt32() {
    const value = this.data.readUInt32LE(this.pos)
    this.pos += 4
    return value
  }

  readFloat() {
    const value = this.data.readFloatLE(this.pos)
    this.pos += 4
    return value
  }

  readFString() {
    const length = this.readInt32()
    if (length === 0) {
      return ''
    } else if (length > 0) {
      const value = this.data.toString('utf8', this.pos, this.pos + length)
      this.pos += length
      return value.replace(/\0$/, '')
    } else {
      const ucs2Length = length * -1 * 2
      const value = this.data.toString('ucs2', this.pos, this.pos + ucs2Length)
      this.pos += ucs2Length
      return value.replace(/\0$/, '')
    }
  }

  async write() {
    return writeFile(this.filename, this.data)
  }

  /**
   * @param {number} value
   */
  writeByte(value) {
    this.data[this.pos++] = value
  }

  /**
   *
   * @param {Buffer} value
   */
  writeBytes(value) {
    value.copy(this.data, this.pos)
    this.pos += value.length
  }

  /**
   * @param {boolean} value
   */
  writeBoolean(value) {
    this.writeByte(value ? 1 : 0)
  }

  /**
   * @param {number} value
   */
  writeInt16(value) {
    this.data.writeInt16LE(value, this.pos)
    this.pos += 2
  }

  /**
   * @param {number} value
   */
  writeInt32(value) {
    this.data.writeInt32LE(value, this.pos)
    this.pos += 4
  }

  /**
   * @param {number | bigint} value
   */
  writeInt64(value) {
    this.data.writeBigInt64LE(BigInt(value), this.pos)
    this.pos += 8
  }

  /**
   * @param {number} value
   */
  writeUInt32(value) {
    this.data.writeUInt32LE(value, this.pos)
    this.pos += 4
  }

  /**
   * @param {number} value
   */
  writeFloat(value) {
    this.data.writeFloatLE(value, this.pos)
    this.pos += 4
  }

  /**
   * @returns {IUFile}
   */
  toJSON() {
    return {
      filename: this.filename,
      data: Array.from(this.data),
    }
  }
}

module.exports = UFile
