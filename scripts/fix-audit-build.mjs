import fs from 'node:fs'
const path = 'src/pages/CreateEvent.tsx'
let source = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
const from = "  bank_note: string | null\n  status: 'upcoming'\n}"
const to = "  bank_note: string | null\n}"
if (!source.includes(from)) throw new Error('EventInsertPayload status field not found')
source = source.replace(from, to)
fs.writeFileSync(path, source)
