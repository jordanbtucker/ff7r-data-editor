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

  static get PropertyType() {
    return {
      BOOLEAN: 1,
      BYTE: 2,
      BOOLEAN_BYTE: 3,
      UINT16: 4,
      INT32: 7,
      FLOAT: 9,
      STRING: 10,
      NAME: 11,
    }
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
            value.push(this.readPropValue(prop))
          }
        } else {
          value = this.readPropValue(prop)
        }

        entry[prop.name] = value
      }

      this.entries.push(entry)
      this.offsets.push(offsetData)
    }
  }

  /**
   * @param {Property} prop
   */
  readPropValue(prop) {
    const {name, type} = prop
    switch (type) {
      case UExport.PropertyType.BOOLEAN:
        return name.endsWith('_Array') ? this.readByte() : this.readInt32()
      case UExport.PropertyType.BYTE:
      case UExport.PropertyType.BOOLEAN_BYTE:
        return this.readByte()
      case UExport.PropertyType.UINT16:
        return this.readInt16()
      case UExport.PropertyType.INT32:
        return this.readInt32()
      case UExport.PropertyType.FLOAT:
        return this.readFloat()
      case UExport.PropertyType.STRING:
        return this.readFString()
      case UExport.PropertyType.NAME:
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
   * @param {string | number} value
   */
  writeFName(value) {
    if (typeof value === 'number') {
      if (value < 0 || value > this.uasset.names.length) {
        throw new RangeError(`Value must be a valid name index. Got ${value}`)
      }
    } else if (typeof value === 'string') {
      const index = this.uasset.names.indexOf(value)
      if (index === -1) {
        throw new Error(
          `Value must be a valid FName in the *.uasset file. Got ${value}`,
        )
      }

      value = index
    } else {
      throw new TypeError(`Value must be a string or number. Got ${value}`)
    }

    this.writeInt32(value)
    this.writeBytes(Buffer.alloc(4))
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
