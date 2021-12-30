const {join} = require('path')
const {app, BrowserWindow, ipcMain, dialog} = require('electron')
const UPackage = require('../lib/upackage')

async function main() {
  await app.whenReady()

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
}

main().catch(err => {
  dialog.showMessageBoxSync({message: err.message})
  process.exitCode = 1
})

let mainWindow

function createMainWindow() {
  mainWindow = new BrowserWindow({
    webPreferences: {
      preload: join(__dirname, '../renderer/preload.js'),
    },
  })

  mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

/** @type {UPackage} */
let upackage

ipcMain.on('open-file', async event => {
  const {canceled, filePaths} = await dialog.showOpenDialog({
    filters: [
      {name: 'UAsset files', extensions: ['uasset']},
      {name: 'All files', extensions: ['*']},
    ],
  })

  if (!canceled) {
    try {
      upackage = await readUPackage(filePaths[0])
      event.reply('upackage-read', JSON.stringify(upackage))
    } catch (err) {
      dialog.showMessageBoxSync({message: err.stack})
    }
  }
})

ipcMain.on('upackage-saved', async (event, entries) => {
  const {uexp} = upackage
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    for (const prop of uexp.props) {
      if (entry[prop.name] != null) {
        uexp.pos = uexp.offsets[i][prop.name]
        writePropertyValue(entry[prop.name], prop.type, uexp)
      }
    }
  }

  const {canceled, filePath} = await dialog.showSaveDialog({
    defaultPath: uexp.filename,
    filters: [{name: 'UExport files', extensions: ['uexp']}],
  })

  if (!canceled) {
    uexp.filename = filePath
    await uexp.write()
  }
})

/**
 * @param {string} filename
 */
async function readUPackage(filename) {
  const upackage = new UPackage(filename)
  await upackage.read()
  return upackage
}

/**
 * @param {number | string | boolean | number[] | string[] | boolean[]} value
 * @param {number} type
 * @param {import('../lib/uexport')} file
 */
function writePropertyValue(value, type, file) {
  switch (type) {
    case 2:
    case 3:
      file.writeByte(Number(value))
      break
    case 4:
      file.writeInt16(Number(value))
      break
    case 7:
      file.writeInt32(Number(value))
      break
    case 9:
      file.writeFloat(Number(value))
      break
    default:
      throw new Error(`Unsupported property type ${type}`)
  }
}
