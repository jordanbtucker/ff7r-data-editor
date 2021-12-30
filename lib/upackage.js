const UAsset = require('./uasset')
const UExport = require('./uexport')

/**
 * @typedef IUPackage
 * @property {UAsset.IUAsset} uasset
 * @property {UExport.IUExport} uexp
 */

class UPackage {
  /**
   * @param {string} filename
   */
  constructor(filename) {
    if (filename.endsWith('.uasset')) {
      this.uassetFilename = filename
      this.uexpFilename = filename.replace(/\.uasset$/, '.uexp')
    } else {
      throw new Error(`Filename must end with .uasset or .uexp`)
    }
  }

  async read() {
    this.uasset = new UAsset(this.uassetFilename)
    await this.uasset.read()

    this.uexp = new UExport(this.uexpFilename, this.uasset)
    await this.uexp.read()
  }

  /**
   * @returns {IUPackage}
   */
  toJSON() {
    return {
      uasset: this.uasset.toJSON(),
      uexp: this.uexp.toJSON(),
    }
  }
}

module.exports = UPackage
