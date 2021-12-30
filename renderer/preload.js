const {ipcRenderer} = require('electron')
const pkg = require('../package.json')

/** @type {import('../lib/upackage').IUPackage} */
let upackage

window.addEventListener('DOMContentLoaded', () => {
  document.title = `${pkg.description} v${pkg.version}`

  document.getElementById('open-file-button').addEventListener('click', () => {
    ipcRenderer.send('open-file')
  })

  document.getElementById('save-file-button').addEventListener('click', () => {
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
          entry[upackage.uexp.props[j - 2].name] = td.innerText
        }
      }

      entries.push(entry)
    }

    ipcRenderer.send('upackage-saved', entries)
  })
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
      td.innerText = entry[prop.name]

      if (prop.name.endsWith('_Array')) {
        td.classList.add('disabled')
      } else {
        switch (prop.type) {
          case 2:
          case 3:
          case 4:
          case 7:
          case 9:
            td.contentEditable = 'true'
            break
          default:
            td.classList.add('disabled')
        }
      }

      td.addEventListener('focus', () => {
        if (td.dataset.originalText == null) {
          td.dataset.originalText = td.innerText
        }

        getSelection().selectAllChildren(td)
      })

      td.addEventListener('blur', () => {
        if (td.innerText !== td.dataset.originalText) {
          td.dataset.isDirty = ''
        } else {
          delete td.dataset.isDirty
        }
      })

      td.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown' || event.key === 'Enter') {
          event.preventDefault()
          const nextTR = td.parentElement.nextElementSibling
          if (nextTR != null) {
            const nextTD = nextTR.cells.item(td.cellIndex)
            nextTD.focus()
            getSelection().selectAllChildren(nextTD)
          }
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          const prevTR = td.parentElement.previousElementSibling
          if (prevTR != null) {
            const prevTD = prevTR.cells.item(td.cellIndex)
            prevTD.focus()
            getSelection().selectAllChildren(prevTD)
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
