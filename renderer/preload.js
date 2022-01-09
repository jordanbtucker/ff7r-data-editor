const {ipcRenderer} = require('electron')
const pkg = require('../package.json')

/** @type {import('../lib/upackage').IUPackage} */
let upackage

window.addEventListener('DOMContentLoaded', () => {
  document.title = `${pkg.description} v${pkg.version}`

  document.getElementById('open-file-button').addEventListener('click', () => {
    ipcRenderer.send('open-file')
  })

  document
    .getElementById('save-file-button')
    .addEventListener('click', saveFile)
})

ipcRenderer.on('upackage-read', (event, json) => {
  upackage = JSON.parse(json)
  const uexp = upackage.uexp
  const table = document.getElementById('entries')
  const thead = document.createElement('thead')
  const tr = document.createElement('tr')

  const indexTH = document.createElement('th')
  indexTH.innerText = '#'
  tr.appendChild(indexTH)

  const tagTH = document.createElement('th')
  tagTH.innerText = 'Tag'
  tr.appendChild(tagTH)

  for (const prop of uexp.props) {
    const th = document.createElement('th')
    th.innerText = prop.name
    tr.appendChild(th)
  }

  thead.appendChild(tr)

  const tbody = document.createElement('tbody')

  for (let i = 0; i < uexp.entries.length; i++) {
    const entry = uexp.entries[i]

    const tr = document.createElement('tr')

    const indexTH = document.createElement('th')
    indexTH.innerText = i
    tr.appendChild(indexTH)

    const tagTH = document.createElement('th')
    tagTH.innerText = entry._tag
    tr.appendChild(tagTH)

    for (const prop of uexp.props) {
      const td = document.createElement('td')
      const value = entry[prop.name]
      const originalValue = String(value)

      if (prop.name.endsWith('_Array')) {
        for (let j = 0; j < value.length; j++) {
          const element = value[j]
          const originalElement = String(element)
          const span = document.createElement('span')

          switch (prop.type) {
            case 2:
            case 3:
            case 4:
            case 7:
            case 9:
              span.innerText = String(element)
              span.contentEditable = 'true'

              span.addEventListener('focus', () => {
                getSelection().selectAllChildren(span)
              })

              span.addEventListener('blur', () => {
                if (span.innerText !== originalElement) {
                  span.dataset.isDirty = ''
                } else {
                  delete span.dataset.isDirty
                }
              })
              break

            case 11:
              span.innerText = element
              span.dataset.dataType = 'fname'
              span.tabIndex = 0

              span.addEventListener('focus', () => {
                const select = document.createElement('select')

                for (const name of upackage.uasset.names) {
                  const option = document.createElement('option')
                  option.innerText = name
                  select.appendChild(option)
                }

                select.value = span.innerText

                select.addEventListener('blur', () => {
                  if (select.value !== originalElement) {
                    span.dataset.isDirty = ''
                  } else {
                    delete span.dataset.isDirty
                  }

                  span.innerText = select.value
                  span.tabIndex = 0
                })

                span.replaceChildren(select)
                span.tabIndex = -1
                select.focus()
              })
              break

            default:
              span.innerText = String(value)
              td.classList.add('disabled')
          }

          td.appendChild(span)

          if (j !== value.length - 1) {
            td.appendChild(document.createTextNode(', '))
          }
        }
      } else {
        switch (prop.type) {
          case 2:
          case 3:
          case 4:
          case 7:
          case 9:
            td.innerText = String(value)
            td.contentEditable = 'true'

            td.addEventListener('focus', () => {
              getSelection().selectAllChildren(td)
            })

            td.addEventListener('blur', () => {
              if (td.innerText !== originalValue) {
                td.dataset.isDirty = ''
              } else {
                delete td.dataset.isDirty
              }
            })
            break

          case 11:
            td.innerText = value
            td.dataset.dataType = 'fname'
            td.tabIndex = 0

            td.addEventListener('focus', () => {
              const select = document.createElement('select')

              for (const name of upackage.uasset.names) {
                const option = document.createElement('option')
                option.innerText = name
                select.appendChild(option)
              }

              select.value = td.innerText

              select.addEventListener('blur', () => {
                if (select.value !== originalValue) {
                  td.dataset.isDirty = ''
                } else {
                  delete td.dataset.isDirty
                }

                td.innerText = select.value
                td.tabIndex = 0
              })

              td.replaceChildren(select)
              td.tabIndex = -1
              select.focus()
            })
            break

          default:
            td.innerText = String(value)
            td.classList.add('disabled')
        }
      }

      td.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown' || event.key === 'Enter') {
          event.preventDefault()
          const nextTR = td.parentElement.nextElementSibling
          if (nextTR != null) {
            const nextTD = nextTR.cells.item(td.cellIndex)
            nextTD.focus()
            if (td.contentEditable === 'true') {
              getSelection().selectAllChildren(nextTD)
            }
          }
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          const prevTR = td.parentElement.previousElementSibling
          if (prevTR != null) {
            const prevTD = prevTR.cells.item(td.cellIndex)
            prevTD.focus()
            if (td.contentEditable === 'true') {
              getSelection().selectAllChildren(prevTD)
            }
          }
        }
      })

      tr.appendChild(td)
    }

    tbody.appendChild(tr)
  }

  table.replaceChildren(thead, tbody)

  document.getElementById('save-file-button').disabled = false
})

ipcRenderer.on('save-file', saveFile)

function saveFile() {
  // Focus away from entries to ensure they are saved.
  document.getElementById('save-file-button').focus()

  const entries = []
  /** @type {HTMLTableElement} */
  const table = document.getElementById('entries')
  const tbody = table.tBodies.item(0)
  for (let i = 0; i < tbody.rows.length; i++) {
    const tr = tbody.rows.item(i)
    const tagTD = tr.cells.item(1)
    const entry = {_td: tagTD.innerText}
    for (let j = 2; j < tr.cells.length; j++) {
      const td = tr.cells.item(j)
      if (td.dataset.isDirty != null) {
        const prop = upackage.uexp.props[j - 2]
        let value
        switch (prop.type) {
          case 2:
          case 3:
          case 4:
          case 7:
          case 9:
            value = Number(td.innerText)
            break
          default:
            value = td.innerText
        }

        entry[prop.name] = value
      } else {
        const spans = td.querySelectorAll('span')
        let array
        for (let k = 0; k < spans.length; k++) {
          const span = spans.item(k)
          if (span.dataset.isDirty != null) {
            const prop = upackage.uexp.props[j - 2]

            if (array == null) {
              array = Array(upackage.uexp.entries[i][prop.name].length)
            }

            let element
            switch (prop.type) {
              case 2:
              case 3:
              case 4:
              case 7:
              case 9:
                element = Number(span.innerText)
                break
              default:
                element = span.innerText
            }

            array[k] = element
            entry[prop.name] = array
          }
        }
      }
    }

    entries.push(entry)
  }

  ipcRenderer.send('upackage-saved', entries)
}
