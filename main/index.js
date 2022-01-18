const {readFile, writeFile} = require('fs/promises')
const os = require('os')
const {basename, dirname, join} = require('path')
const {app, BrowserWindow, dialog, ipcMain, Menu, shell} = require('electron')
const {default: Conf} = require('conf')
const Papa = require('papaparse')
const pkg = require('../package.json')
const UPackage = require('../lib/upackage')
const {PropertyType} = require('../lib/uexport')

const UPACKAGE_OPEN_DIALOG_DEFAULT_PATH_ID = 'upackageOpenDialogDefaultPath'
const UPACKAGE_SAVE_DIALOG_DEFAULT_PATH_ID = 'upackageSaveDialogDefaultPath'
const CSV_DIALOG_DEFAULT_PATH_ID = 'csvFileDialogDefaultPath'

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
          label: 'Import...',
          id: 'import',
          enabled: false,
          accelerator: 'Control+I',
          click: importCSV,
        },
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
          label: 'Report an Issue...',
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
  try {
    const {canceled, filePaths} = await dialog.showOpenDialog({
      defaultPath: conf.get(UPACKAGE_OPEN_DIALOG_DEFAULT_PATH_ID),
      filters: [
        {name: 'UAsset files', extensions: ['uasset']},
        {name: 'All files', extensions: ['*']},
      ],
    })

    if (!canceled) {
      upackage = new UPackage(filePaths[0])
      await upackage.read()
      mainWindow.webContents.send('upackage-opened', JSON.stringify(upackage))
      const menu = Menu.getApplicationMenu()
      menu.getMenuItemById('save').enabled = true
      menu.getMenuItemById('import').enabled = true
      menu.getMenuItemById('export').enabled = true
      conf.set(UPACKAGE_OPEN_DIALOG_DEFAULT_PATH_ID, dirname(filePaths[0]))
    }
  } catch (err) {
    reportError(err)
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

    let defaultPath = conf.get(UPACKAGE_SAVE_DIALOG_DEFAULT_PATH_ID)
    if (defaultPath != null) {
      defaultPath = join(defaultPath, uexp.filename)
    }

    const {canceled, filePath} = await dialog.showSaveDialog({
      defaultPath,
      filters: [{name: 'UExport files', extensions: ['uexp']}],
    })

    if (!canceled) {
      uexp.filename = filePath
      await uexp.write()
      conf.set(UPACKAGE_SAVE_DIALOG_DEFAULT_PATH_ID, dirname(filePath))
      mainWindow.send('upackage-saved', filePath)
    }
  } catch (err) {
    reportError(err)
  }
}

function find() {
  mainWindow.webContents.send('find')
}

async function exportCSV() {
  mainWindow.webContents.send('export-csv')
}

const csvArrayFieldRegExp = /^(.+)\[(\d+)]$/

async function importCSV() {
  try {
    const {canceled, filePaths} = await dialog.showOpenDialog({
      defaultPath: conf.get(CSV_DIALOG_DEFAULT_PATH_ID),
      filters: [
        {name: 'CSV files', extensions: ['csv']},
        {name: 'All files', extensions: ['*']},
      ],
    })

    if (!canceled) {
      const csv = await readFile(filePaths[0], 'utf8')
      const {data, errors} = Papa.parse(csv, {
        delimiter: ',',
        header: true,
        skipEmptyLines: true,
      })

      if (errors.length > 0) {
        throw errors[0]
      }

      const {uasset, uexp} = upackage
      const {props, entries} = uexp
      const csvBasename = basename(filePaths[0])
      const uexpBasename = basename(uexp.filename)
      const csvEntries = []

      if (data.length !== entries.length) {
        throw new Error(
          `The number of records in ${csvBasename} does not match the number of entries in ${uexpBasename}. Expected ${entries.length}, got ${data.length}`,
        )
      }

      for (let i = 0; i < data.length; i++) {
        const line = data[i]
        const entry = entries[i]
        const lineNumber = i + 2
        const csvEntry = {}

        for (const field of Object.keys(line)) {
          const value = line[field]
          if (field === 'Tag') {
            if (line.Tag !== entry.$tag) {
              throw new Error(
                `Tag mismatch in ${csvBasename} on line ${lineNumber}. Expected '${entry.$tag}', got '${line.Tag}'`,
              )
            }

            csvEntry.$tag = value
          } else {
            const arrayMatch = csvArrayFieldRegExp.exec(field)
            const propName = arrayMatch != null ? arrayMatch[1] : field

            const prop = props.find(prop => prop.name === propName)
            if (prop == null) {
              throw new Error(`Unknown field '${propName}' in ${csvBasename}`)
            }

            const entryValue = entry[propName]
            if (arrayMatch != null) {
              if (csvEntry[propName] == null) {
                csvEntry[propName] = []
              }

              const index = Number(arrayMatch[2])
              if (index >= entryValue.length) {
                if (value === '') {
                  continue
                }

                throw new RangeError(
                  `Array index out of range for field ${field} in ${csvBasename} on line ${lineNumber} for corresponding entry in ${uexpBasename}. Expected max ${
                    entryValue.length - 1
                  }, got ${index}`,
                )
              }

              const entryElement = entryValue[index]
              csvEntry[propName][index] = validateProperty(
                prop.type,
                value,
                entryElement,
                field,
                lineNumber,
                uasset.names,
                filePaths[0],
                uexp.filename,
                uasset.filename,
              )
            } else {
              csvEntry[propName] = validateProperty(
                prop.type,
                value,
                entryValue,
                field,
                lineNumber,
                uasset.names,
                filePaths[0],
                uexp.filename,
                uasset.filename,
              )
            }
          }
        }

        csvEntries[i] = csvEntry
      }

      mainWindow.webContents.send('csv-imported', csvEntries)
    }
  } catch (err) {
    reportError(err)
  }
}

const textFormulaRegExp = /^="(.+)"$/

/**
 * @param {number} type
 * @param {number | string} value
 * @param {string} originalValue
 * @param {string} field
 * @param {number} lineNumber
 * @param {string[]} names
 * @param {string} csvFilename
 * @param {string} uexpFilename
 * @param {string} uassetFilename
 * @returns
 */
function validateProperty(
  type,
  value,
  originalValue,
  field,
  lineNumber,
  names,
  csvFilename,
  uexpFilename,
  uassetFilename,
) {
  const csvBasename = basename(csvFilename)
  const uexpBasename = basename(uexpFilename)
  const uassetBasename = basename(uassetFilename)

  let number
  let textFormulaMatch
  switch (type) {
    case PropertyType.BOOLEAN:
    case PropertyType.BYTE:
    case PropertyType.BOOLEAN_BYTE:
    case PropertyType.UINT16:
    case PropertyType.INT32:
    case PropertyType.FLOAT:
      textFormulaMatch = textFormulaRegExp.exec(value)
      if (textFormulaMatch != null) {
        number = Number(textFormulaMatch[1])
      } else {
        number = Number(value)
      }

      if (isNaN(number)) {
        throw new TypeError(
          `Invalid value for field ${field} in ${csvBasename} on line ${lineNumber}. Expected a number, got '${value}'`,
        )
      }

      return number

    case PropertyType.STRING:
      if (value !== originalValue) {
        throw new Error(
          `Unsupported string modification for field ${field} in ${csvBasename} on line ${lineNumber}`,
        )
      }

      return value

    case PropertyType.NAME:
      if (!names.includes(value)) {
        throw new RangeError(
          `Invalid name '${value}' for field ${field} in ${csvBasename} on line ${lineNumber}. The name does not exist in ${uassetBasename}`,
        )
      }

      return value

    default:
      throw new Error(`Unsupported property type ${type} in ${uexpBasename}`)
  }
}

ipcMain.on('csv-exported', (event, entries) => {
  csvExported(entries)
})

/**
 * @param {import('../renderer/preload').SparseEntry[]} entries
 */
async function csvExported(entries) {
  try {
    const {response} = await dialog.showMessageBox(mainWindow, {
      title: 'How should numbers be exported?',
      message:
        'Microsoft Excel and Google Sheets do not preserve numbers correctly unless they are exported as text formulas. Other CSV applications may not be able to read numbers as text formulas.',
      buttons: [
        'Export numbers as text formulas',
        'Export numbers as-is',
        'Cancel',
      ],
    })

    let exportNumbersAsText
    switch (response) {
      case 0:
        exportNumbersAsText = true
        break
      case 1:
        exportNumbersAsText = false
        break
      case 2:
        return
    }

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

            if (typeof value === 'number' && exportNumbersAsText) {
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
          if (typeof value === 'number' && exportNumbersAsText) {
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

    let defaultPath = conf.get(CSV_DIALOG_DEFAULT_PATH_ID)
    if (defaultPath == null) {
      defaultPath = uexp.filename.replace(/\.uexp$/i, '.csv')
    } else {
      defaultPath = join(
        defaultPath,
        basename(uexp.filename).replace(/\.uexp$/i, '.csv'),
      )
    }

    const {canceled, filePath} = await dialog.showSaveDialog({
      defaultPath,
      filters: [
        {name: 'CSV files', extensions: ['csv']},
        {name: 'All files', extensions: ['*']},
      ],
    })

    if (!canceled) {
      await writeFile(filePath, csv)
      conf.set(CSV_DIALOG_DEFAULT_PATH_ID, dirname(filePath))
      mainWindow.webContents.send('csv-exported', filePath)
    }
  } catch (err) {
    reportError(err)
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

ipcMain.on('error', (event, err) => {
  reportError(err)
})

function reportError(err) {
  const buttonID = dialog.showMessageBoxSync(mainWindow, {
    type: 'error',
    title: 'Error',
    message: err.stack,
    buttons: ['Report This Issue', 'Close'],
    noLink: true,
    defaultId: 1,
    cancelId: 1,
  })

  if (buttonID === 0) {
    const issueURL = new URL(pkg.bugs.url)
    issueURL.pathname += '/new'
    issueURL.searchParams.set('title', err.message)
    issueURL.searchParams.set(
      'body',
      `Your issue may already be reported.
Please search on the [issue tracker](${pkg.bugs.url}) before creating one.

## Error Message
${err.message}

## Expected Behavior


## Actual Behavior


## Steps to Reproduce the Problem
1.
2.
3.

## Error Stack
\`\`\`
${err.stack}
\`\`\`

## Specifications
- **Version:** ${pkg.version}
- **Platform:** ${os.platform()} / ${os.version()}
`,
    )
    shell.openExternal(issueURL.toString())
  }
}
