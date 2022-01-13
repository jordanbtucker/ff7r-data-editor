const {dirname, join} = require('path')
const {app, BrowserWindow, dialog, ipcMain, Menu, shell} = require('electron')
const {default: Conf} = require('conf')
const pkg = require('../package.json')
const UPackage = require('../lib/upackage')

const UPACKAGE_OPEN_DIALOG_DEFAULT_PATH_ID = 'upackageOpenDialogDefaultPath'
const UPACKAGE_SAVE_DIALOG_DEFAULT_PATH_ID = 'upackageSaveDialogDefaultPath'

const conf = new Conf()

const isMac = process.platform === 'darwin'

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

/** @type {BrowserWindow} */
let mainWindow

function createMainWindow() {
  mainWindow = new BrowserWindow({
    webPreferences: {
      preload: join(__dirname, '../renderer/preload.js'),
    },
  })

  mainWindow.loadFile(join(__dirname, '../renderer/index.html'))

  /** @type {(Electron.MenuItemConstructorOptions | Electron.MenuItem)[]} */
  const menuTemplate = [
    ...(isMac ? [{role: 'appMenu'}] : []),
    {
      label: 'File',
      submenu: [
        {label: 'Open...', accelerator: 'Control+O', click: openUPackage},
        {
          label: 'Save...',
          id: 'save',
          enabled: false,
          accelerator: 'Control+S',
          click: saveUPackage,
        },
        {type: 'separator'},
        {role: 'quit'},
      ],
    },
    {
      role: 'editMenu',
      submenu: [
        {role: 'undo'},
        {role: 'redo'},
        {type: 'separator'},
        {role: 'cut'},
        {role: 'copy'},
        {role: 'paste'},
        {role: 'delete'},
        {type: 'separator'},
        {role: 'selectAll'},
        {type: 'separator'},
        {label: 'Find...', accelerator: 'Control+F', click: handleFind},
      ],
    },
    {role: 'viewMenu'},
    {role: 'windowMenu'},
    {
      role: 'help',
      submenu: [
        {
          label: 'View Project on GitHub...',
          click: async () => {
            await shell.openExternal(pkg.homepage)
          },
        },
        {
          label: 'Report a Bug...',
          click: async () => {
            await shell.openExternal(pkg.bugs.url)
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)
}

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit()
  }
})

/** @type {UPackage} */
let upackage

ipcMain.on('open-upackage', openUPackage)

async function openUPackage() {
  const {canceled, filePaths} = await dialog.showOpenDialog({
    defaultPath: conf.get(UPACKAGE_OPEN_DIALOG_DEFAULT_PATH_ID),
    filters: [
      {name: 'UAsset files', extensions: ['uasset']},
      {name: 'All files', extensions: ['*']},
    ],
  })

  if (!canceled) {
    try {
      upackage = new UPackage(filePaths[0])
      await upackage.read()
      mainWindow.webContents.send('upackage-opened', JSON.stringify(upackage))
      const menu = Menu.getApplicationMenu()
      menu.getMenuItemById('save').enabled = true
      conf.set(UPACKAGE_OPEN_DIALOG_DEFAULT_PATH_ID, dirname(filePaths[0]))
    } catch (err) {
      dialog.showMessageBoxSync({message: err.stack})
    }
  }
}

function saveUPackage() {
  mainWindow.webContents.send('save-upackage')
}

ipcMain.on('upackage-saved', async (event, entries) => {
  upackageSaved(entries)
})

/**
 * @param {import('../renderer/preload').SparseEntry[]} entries
 */
async function upackageSaved(entries) {
  try {
    const {uexp} = upackage

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      for (const prop of uexp.props) {
        if (entry[prop.name] != null) {
          if (prop.name.endsWith('_Array')) {
            const elements = entry[prop.name]
            for (let j = 0; j < elements.length; j++) {
              if (elements[j] != null) {
                uexp.pos = uexp.offsets[i][prop.name]
                writePropertyArrayElement(elements[j], j, prop.type, uexp)
              }
            }
          } else {
            uexp.pos = uexp.offsets[i][prop.name]
            writePropertyValue(entry[prop.name], prop.type, uexp)
          }
        }
      }
    }

    const {canceled, filePath} = await dialog.showSaveDialog({
      defaultPath:
        conf.get(UPACKAGE_SAVE_DIALOG_DEFAULT_PATH_ID) || uexp.filename,
      filters: [{name: 'UExport files', extensions: ['uexp']}],
    })

    if (!canceled) {
      uexp.filename = filePath
      await uexp.write()
      conf.set(UPACKAGE_SAVE_DIALOG_DEFAULT_PATH_ID, dirname(filePath))
      mainWindow.send('upackage-saved', upackage.uexpFilename)
    }
  } catch (err) {
    dialog.showMessageBoxSync({message: err.stack})
  }
}

function handleFind() {
  mainWindow.webContents.send('find')
}

/**
 * @param {number | string | boolean | number[] | string[] | boolean[]} value
 * @param {number} type
 * @param {import('../lib/uexport')} file
 */
function writePropertyValue(value, type, file) {
  let number
  switch (type) {
    case 1:
    case 7:
      number = Number(value)
      if (isNaN(number)) {
        throw new Error('Value must be a number')
      }

      file.writeInt32(number)
      break
    case 2:
    case 3:
      number = Number(value)
      if (isNaN(number)) {
        throw new Error('Value must be a number')
      }

      file.writeByte(number)
      break
    case 4:
      number = Number(value)
      if (isNaN(number)) {
        throw new Error('Value must be a number')
      }

      file.writeInt16(number)
      break
    case 9:
      number = Number(value)
      if (isNaN(number)) {
        throw new Error('Value must be a number')
      }

      file.writeFloat(number)
      break
    case 11:
      file.writeFName(value)
      break
    default:
      throw new Error(`Unsupported property type ${type}`)
  }
}

/**
 *
 * @param {number | string | boolean} value
 * @param {number} index
 * @param {number} type
 * @param {import('../lib/uexport')} file
 */
function writePropertyArrayElement(value, index, type, file) {
  file.pos += 4

  let number
  switch (type) {
    case 1:
    case 2:
    case 3:
      number = Number(value)
      if (isNaN(number)) {
        throw new Error('Value must be a number')
      }

      file.pos += index
      file.writeByte(number)
      break
    case 4:
      number = Number(value)
      if (isNaN(number)) {
        throw new Error('Value must be a number')
      }

      file.pos += index * 2
      file.writeInt16(number)
      break
    case 7:
      number = Number(value)
      if (isNaN(number)) {
        throw new Error('Value must be a number')
      }

      file.pos += index * 4
      file.writeInt32(number)
      break
    case 9:
      number = Number(value)
      if (isNaN(number)) {
        throw new Error('Value must be a number')
      }

      file.pos += index * 4
      file.writeFloat(number)
      break
    case 11:
      file.pos += index * 8
      file.writeFName(value)
      break
    default:
      throw new Error(`Unsupported property type ${type}`)
  }
}
