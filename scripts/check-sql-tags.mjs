import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export function checkSqlTags(sql, file = '<sql>') {
  const pairs = []
  const fail = (message, offset) => { throw Error(`${file}:${sql.slice(0,offset).split('\n').length}: ${message}`) }
  function scan(start, end) {
    for (let i=start; i<end;) {
      if (sql.startsWith('--',i)) { const next=sql.indexOf('\n',i+2); i=next<0?end:next+1; continue }
      if (sql.startsWith('/*',i)) {
        const opened=i; let depth=1; i+=2
        while(i<end && depth) {
          if(sql.startsWith('/*',i)){depth++;i+=2}
          else if(sql.startsWith('*/',i)){depth--;i+=2}
          else i++
        }
        if(depth) fail('Unclosed block comment',opened)
        continue
      }
      if(sql[i]==="'" || sql[i]==='"') {
        const opened=i, quote=sql[i++], escaped=quote==="'" && /[eE]/.test(sql[opened-1]??'') && !/[\w]/.test(sql[opened-2]??'')
        let closed=false
        while(i<end) {
          if(escaped && sql[i]==='\\'){i+=2;continue}
          if(sql[i]===quote){if(sql[i+1]===quote){i+=2;continue}i++;closed=true;break}
          i++
        }
        if(!closed) fail('Unclosed quoted string or identifier',opened)
        continue
      }
      if(sql[i]!=='$'){i++;continue}
      if(/[\w$]/.test(sql[i-1]??'')){i++;continue} // Dollar inside an unquoted identifier.
      if(/\d/.test(sql[i+1]??'')){i+=2;while(/\d/.test(sql[i]??''))i++;continue} // $1 parameter.
      const tag=sql.slice(i,end).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/)?.[0]
      if(!tag) fail('Stray dollar delimiter (expected $$ or $name$)',i)
      const close=sql.indexOf(tag,i+tag.length)
      if(close<0 || close>=end) fail(`Unpaired dollar tag ${tag}`,i)
      scan(i+tag.length,close)
      pairs.push({tag,line:sql.slice(0,i).split('\n').length})
      i=close+tag.length
    }
  }
  scan(0,sql.length)
  return pairs
}
export function sqlFiles() {
  return ['docs/sql','supabase/migrations'].flatMap(dir=>fs.readdirSync(dir,{recursive:true}).filter(name=>String(name).endsWith('.sql')).map(name=>path.join(dir,String(name))))
}
if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  let pairs=0
  for(const file of sqlFiles()) pairs+=checkSqlTags(fs.readFileSync(file,'utf8'),file).length
  console.log(`Checked ${sqlFiles().length} SQL files, ${pairs} paired dollar-quoted bodies.`)
}
