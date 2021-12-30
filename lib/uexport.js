const UFile = require('./ufile')

/**
 * @typedef Property
 * @property {string} name
 * @property {number} type
 */

/**
 * @typedef Entry
 * @property {string} _tag
 */

/**
 * @typedef IUExport
 * @property {string} filename
 * @property {Property[]} props
 * @property {Entry[]} entries
 */

class UExport extends UFile {
  /**
   * @param {string} filename
   * @param {import('./uasset')} uasset
   */
  constructor(filename, uasset) {
    super(filename)
    /** @type {import('./uasset')} */
    this.uasset = uasset
  }

  async read() {
    await super.read()
    this.readEntries()
  }

  readEntries() {
    this.header = this.readBytes(0x0a)
    this.entriesCount = this.readInt32()
    this.propsCount = this.readInt32()
    /** @type {Property[]} */
    this.props = []
    for (let i = 0; i < this.propsCount; i++) {
      const name = this.readFName()
      const type = this.readByte()
      this.props.push({name, type})
    }

    /** @type {Entry[]} */
    this.entries = []
    this.offsets = []
    for (let i = 0; i < this.entriesCount; i++) {
      const entry = {}
      const offsetData = {}
      entry._tag = this.readFName()

      for (const prop of this.props) {
        offsetData[prop.name] = this.pos

        let value
        if (prop.name.endsWith('_Array')) {
          value = []
          const length = this.readInt32()
          for (let j = 0; j < length; j++) {
            value.push(this.readPropValue(prop.type))
          }
        } else {
          value = this.readPropValue(prop.type)
        }

        entry[prop.name] = value
      }

      this.entries.push(entry)
      this.offsets.push(offsetData)
    }
  }

  /**
   * @param {number} type
   */
  readPropValue(type) {
    switch (type) {
      case 1:
        // BattleAICharaSpec.uexp uses one-byte values
        // for this property type for some reason
        return this.readBytes(4)
      case 2:
      case 3:
        return this.readByte()
      case 4:
        return this.readInt16()
      case 7:
        return this.readInt32()
      case 9:
        return this.readFloat()
      case 10:
        return this.readFString()
      case 11:
        return this.readFName()
      default:
        throw new Error(`Unknown property type ${type}`)
    }
  }

  readFName() {
    const index = this.readInt32()
    this.readBytes(4)
    return this.uasset.names[index]
  }

  /**
   * @returns {IUExport}
   */
  toJSON() {
    return {
      filename: this.filename,
      props: this.props,
      entries: this.entries,
    }
  }
}

module.exports = UExport
