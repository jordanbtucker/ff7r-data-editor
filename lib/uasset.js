const UFile = require('./ufile')

/**
 * @typedef IExportDefinition
 * @property {string} objectName
 * @property {number} serialSize
 * @property {number} serialOffset
 */

/**
 * @typedef IUAsset
 * @property {string} filename
 * @property {string[]} names
 * @property {IExportDefinition[]} exports
 */

const VALID_TAG = 0x9e2a83c1

class UAsset extends UFile {
  async read() {
    await super.read()
    this.readHeader()
    this.readNames()
    this.readExports()
  }

  readHeader() {
    this.tag = this.readUInt32()
    if (this.tag !== VALID_TAG) {
      throw new Error(`Invalid tag ${this.tag}`)
    }

    this.version = this.readUInt32()
    this.legacyVersion = this.version & 0xffffffff

    if (this.legacyVersion !== -4) {
      this.ue3Version = this.readInt32()
    }

    this.version = this.readInt32()
    this.licenseeVersion = this.readInt32() & 0xffff
    this.fileVersion = this.version & 0xffff

    if ((this.version & 0xffff) !== 0) {
      throw new Error(`Invalid version ${this.version}`)
    }

    if (this.licenseeVersion !== 0) {
      throw new Error(`Invalid licensee version ${this.licenseeVersion}`)
    }

    if (this.fileVersion !== 0) {
      throw new Error(`Invalid file version ${this.fileVersion}`)
    }

    if (this.legacyVersion <= -2) {
      this.customVersionsCount = this.readInt32()
      if (this.customVersionsCount !== 0) {
        throw new Error('Unsupported custom versions')
      }
    }

    this.headersSize = this.readInt32()
    this.packageGroup = this.readFString()
    this.packageFlags = this.readInt32()

    this.namesCount = this.readInt32()
    this.namesOffset = this.readInt32()
    this.gatherableTextDataCount = this.readInt32()
    this.gatherableTextDataOffset = this.readInt32()
    this.exportsCount = this.readInt32()
    this.exportsOffset = this.readInt32()

    if (this.exportsCount != 1) {
      throw new Error(`Unsupported export count ${this.exportsCount}`)
    }

    // this.importsCount = this.readInt32()
    // this.importsOffset = this.readInt32()

    // let restEnd = this.data.length
    // if (this.namesCount > 0) {
    //   restEnd = this.namesOffset
    // }

    // if (
    //   this.gatherableTextDataCount > 0 &&
    //   this.gatherableTextDataOffset > restEnd
    // ) {
    //   restEnd = this.gatherableTextDataOffset
    // }

    // if (this.exportsCount > 0 && this.exportsOffset > restEnd) {
    //   restEnd = this.exportsOffset
    // }

    // this.headerRest = this.readBytes(this.data.length - restEnd)
  }

  readNames() {
    this.pos = this.namesOffset

    /** @type {string[]} */
    this.names = []

    for (let i = 0; i < this.namesCount; i++) {
      const name = this.readFString()
      this.readBytes(4)
      this.names.push(name)
    }
  }

  readExports() {
    this.pos = this.exportsOffset

    /** @type {ExportDefinition[]} */
    this.exports = []

    for (let i = 0; i < this.exportsCount; i++) {
      const definition = new ExportDefinition(this)
      definition.read()
      this.exports.push(definition)
    }
  }

  readFName() {
    const nameIndex = this.readInt32()
    this.readBytes(4)
    return this.names[nameIndex]
  }

  /**
   * @returns {IUAsset}
   */
  toJSON() {
    return {
      filename: this.filename,
      names: this.names,
      exports: this.exports,
    }
  }
}

class ExportDefinition {
  /**
   * @param {UAsset} uasset
   */
  constructor(uasset) {
    this.uasset = uasset
  }

  read() {
    this.classIndex = this.uasset.readInt32()
    this.superIndex = this.uasset.readInt32()
    this.templateIndex = this.uasset.readInt32()
    this.packageIndex = this.uasset.readInt32()
    this.objectName = this.uasset.readFName()
    this.objectFlags = this.uasset.readUInt32()
    this.serialSize = this.uasset.readInt64()
    this.serialOffset = this.uasset.readInt64()
    this.isForcedExport = this.uasset.readBoolean()
    this.isNotForClient = this.uasset.readBoolean()
    this.isNotForServer = this.uasset.readBoolean()
    this.guid = this.uasset.readBytes(16)
    this.packageFlags = this.uasset.readInt32()
    this.isNotForEditorGame = this.uasset.readBoolean()
    this.isAsset = this.uasset.readBoolean()

    if (this.serialSize > Number.MAX_SAFE_INTEGER) {
      throw new Error(`Unsupported export size ${this.serialSize}`)
    }

    if (this.serialOffset > Number.MAX_SAFE_INTEGER) {
      throw new Error(`Unsupported export offset ${this.serialOffset}`)
    }

    this.serialSize = Number(this.serialSize)
    this.serialOffset = Number(this.serialOffset)
  }

  /**
   * @returns {IExportDefinition}
   */
  toJSON() {
    return {
      objectName: this.objectName,
      serialSize: this.serialSize,
      serialOffset: this.serialOffset,
    }
  }
}

module.exports = UAsset
