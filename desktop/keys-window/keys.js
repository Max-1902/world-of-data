// Key window: lists desktop/keys.ts's KEY_FIELDS and saves them through window.keyStore (keys-preload.ts).
const form = document.getElementById('form')
const status = document.getElementById('status')
const reveal = document.getElementById('reveal')

function setStatus(text, kind) {
  status.textContent = text
  status.className = kind || ''
}

function el(tag, props, children) {
  const node = Object.assign(document.createElement(tag), props)
  for (const c of children || []) node.append(c)
  return node
}

async function init() {
  const { fields, values, encryption } = await window.keyStore.load()
  document.getElementById('encryption').hidden = encryption
  for (const f of fields) {
    const input = el('input', { id: f.id, name: f.id, value: values[f.id] || '', autocomplete: 'off', spellcheck: false, type: f.secret ? 'password' : 'text' })
    input.dataset.secret = String(f.secret)
    const head = el('div', { className: 'field-head' }, [el('label', { htmlFor: f.id, textContent: f.label })])
    if (f.required) head.append(el('span', { className: 'tag', textContent: 'REQUIRED' }))
    if (f.url) {
      const get = el('button', { type: 'button', className: 'get', textContent: 'Get a key' })
      get.addEventListener('click', () => window.keyStore.openUrl(f.url))
      head.append(get)
    }
    const children = [head, input]
    if (f.help) children.push(el('div', { className: 'help', textContent: f.help }))
    form.append(el('div', { className: 'field' }, children))
  }
}

document.getElementById('import').addEventListener('click', async () => {
  try {
    const found = await window.keyStore.importEnv()
    if (!found) return
    const ids = Object.keys(found)
    for (const id of ids) { const input = document.getElementById(id); if (input) input.value = found[id] }
    setStatus(ids.length ? `Filled ${ids.length} key${ids.length === 1 ? '' : 's'} from the file. Check them, then save.` : 'No known keys in that file.', ids.length ? 'ok' : 'err')
  } catch (err) {
    setStatus(`Could not import: ${err && err.message ? err.message : err}`, 'err')
  }
})

reveal.addEventListener('change', () => {
  for (const input of form.querySelectorAll('input[data-secret="true"]')) input.type = reveal.checked ? 'text' : 'password'
})

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const values = Object.fromEntries(new FormData(form))
  if (!String(values.VITE_MAPBOX_TOKEN || '').trim()) { setStatus('The map needs a Mapbox token.', 'err'); return }
  try {
    const { encrypted } = await window.keyStore.save(values)
    setStatus(encrypted ? 'Saved (encrypted). The app has reloaded.' : 'Saved. The app has reloaded.', 'ok')
  } catch (err) {
    setStatus(`Could not save: ${err && err.message ? err.message : err}`, 'err')
  }
})

init().catch((err) => setStatus(`Could not load keys: ${err && err.message ? err.message : err}`, 'err'))
