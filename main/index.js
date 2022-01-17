const {writeFile} = require('fs/promises')
const {dirname, join} = require('path')
const {app, BrowserWindow, dialog, ipcMain, Menu, shell} = require('electron')
const {default: Conf} = require('conf')
const Papa = require('papaparse')
const pkg = require('../package.json')
const UPackage = require('../lib/upackage')
const {PropertyType} = require('../lib/uexport')

const UPACKAGE_OPEN_DIALOG_DEFAULT_PATH_ID = 'upackageOpenDialogDefaultPath'
const UPACKAGE_SAVE_DIALOG_DEFAULT_PATH_ID = 'upackageSaveDialogDefaultPath'
const CSV_SAVE_DIALOG_DEFAULT_PATH_ID = 'csvSaveFileDialogDefaultPath'

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
        {
          label: 'Open...',
          accelerator: 'Control+O',
          click: openUPackage,
        },
        {
          label: 'Save...',
          id: 'save',
          enabled: false,
          accelerator: 'Control+S',
          click: saveUPackage,
        },
        {type: 'separator'},
        {
          label: 'Export...',
          id: 'export',
          enabled: false,
          accelerator: 'Control+E',
          click: exportCSV,
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
        {
          label: 'Find...',
          accelerator: 'Control+F',
          click: find,
        },
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
      menu.getMenuItemById('export').enabled = true
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
      mainWindow.send('upackage-saved', filePath)
    }
  } catch (err) {
    dialog.showMessageBoxSync({message: err.stack})
  }
}

function find() {
  mainWindow.webContents.send('find')
}

async function exportCSV() {
  mainWindow.webContents.send('export-csv')
}

ipcMain.on('csv-exported', (event, entries) => {
  csvExported(entries)
})

/**
 * @param {import('../renderer/preload').SparseEntry[]} entries
 */
async function csvExported(entries) {
  try {
    const {uexp} = upackage
    const {props} = uexp
    const fields = ['Tag']
    const data = []
    const columnSizes = {Tag: 1}

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      const line = {Tag: entry.$tag}
      for (const prop of props) {
        const value = entry[prop.name]
        if (prop.name.endsWith('_Array')) {
          for (let j = 0; j < value.length; j++) {
            const field = `${prop.name}[${j}]`
            const element = value[j]

            if (typeof element === 'number') {
              line[field] = `="${element}"`
            } else {
              line[field] = element
            }
          }

          if (
            columnSizes[prop.name] == null ||
            columnSizes[prop.name] < value.length
          ) {
            columnSizes[prop.name] = value.length
          }
        } else {
          if (typeof value === 'number') {
            line[prop.name] = `="${value}"`
          } else {
            line[prop.name] = value
          }
        }
      }

      data.push(line)
    }

    for (const prop of props) {
      if (prop.name.endsWith('_Array')) {
        for (let i = 0; i < columnSizes[prop.name]; i++) {
          fields.push(`${prop.name}[${i}]`)
        }
      } else {
        fields.push(prop.name)
      }
    }

    const csv = Papa.unparse({fields, data})
    const {canceled, filePath} = await dialog.showSaveDialog({
      defaultPath:
        conf.get(CSV_SAVE_DIALOG_DEFAULT_PATH_ID) ||
        uexp.filename.replace(/\.uexp$/, '.csv'),
      filters: [
        {name: 'CSV files', extensions: ['csv']},
        {name: 'All files', extensions: ['*']},
      ],
    })

    if (!canceled) {
      await writeFile(filePath, csv)
      conf.set(CSV_SAVE_DIALOG_DEFAULT_PATH_ID, filePath)
    }
  } catch (err) {
    dialog.showMessageBoxSync({message: err.stack})
  }
}

/**
 * @param {number | string | boolean | number[] | string[] | boolean[]} value
 * @param {number} type
 * @param {import('../lib/uexport')} file
 */
function writePropertyValue(value, type, file) {
  let number
  switch (type) {
    case PropertyType.BOOLEAN:
    case PropertyType.INT32:
      number = Number(value)
      if (isNaN(number)) {
        throw new Error('Value must be a number')
      }

      file.writeInt32(number)
      break
    case PropertyType.BYTE:
    case PropertyType.BOOLEAN_BYTE:
      number = Number(value)
      if (isNaN(number)) {
        throw new Error('Value must be a number')
      }

      file.writeByte(number)
      break
    case PropertyType.UINT16:
      number = Number(value)
      if (isNaN(number)) {
        throw new Error('Value must be a number')
      }

      file.writeInt16(number)
      break
    case PropertyType.FLOAT:
      number = Number(value)
      if (isNaN(number)) {
        throw new Error('Value must be a number')
      }

      file.writeFloat(number)
      break
    case PropertyType.NAME:
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
    case PropertyType.BOOLEAN:
    case PropertyType.BYTE:
    case PropertyType.BOOLEAN_BYTE:
      number = Number(value)
      if (isNaN(number)) {
        throw new Error('Value must be a number')
      }

      file.pos += index
      file.writeByte(number)
      break
    case PropertyType.UINT16:
      number = Number(value)
      if (isNaN(number)) {
        throw new Error('Value must be a number')
      }

      file.pos += index * 2
      file.writeInt16(number)
      break
    case PropertyType.INT32:
      number = Number(value)
      if (isNaN(number)) {
        throw new Error('Value must be a number')
      }

      file.pos += index * 4
      file.writeInt32(number)
      break
    case PropertyType.FLOAT:
      number = Number(value)
      if (isNaN(number)) {
        throw new Error('Value must be a number')
      }

      file.pos += index * 4
      file.writeFloat(number)
      break
    case PropertyType.NAME:
      file.pos += index * 8
      file.writeFName(value)
      break
    default:
      throw new Error(`Unsupported property type ${type}`)
  }
}
