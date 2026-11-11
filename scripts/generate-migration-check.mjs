// Generates catalog-only SQL; never connects to a database.
import fs from 'node:fs'
const q = s => "'" + s.replaceAll("'", "''") + "'"
const rows = []
const ident = String.raw`[a-z_][a-z_0-9]*(?:\.[a-z_][a-z_0-9]*)?`
const qualified = n => n.includes('.') ? n : `public.${n}`
const parts = s => { let depth = 0; return s.split(/,(?![^']*'(?:[^']*'[^']*')*[^']*$)/).reduce((a, x) => { if (depth) a[a.length-1] += ',' + x; else a.push(x); depth += (x.match(/\(/g)||[]).length - (x.match(/\)/g)||[]).length; return a }, []) }
const sig = (n, args) => qualified(n) + '(' + args.split(',').map(a => a.trim().replace(/\s+default\s+[\s\S]*/i,'').replace(/^p_\w+\s+|^(?:user_lat|user_lng|radius_km|filter_category|filter_min_age|filter_max_age|lng|lat)\s+/i,'').replace(/\bfloat8\b/gi,'double precision').replace(/\bint\b/gi,'integer')).join(',') + ')'
for (const file of fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()) {
  const original = fs.readFileSync('supabase/migrations/'+file,'utf8')
  // Remove comments and function/DO bodies before scanning top-level DDL.
  const sql = original.replace(/--[^\n]*/g,'').replace(/\$(\w*)\$[\s\S]*?\$\1\$/g,'$$ $$')
  const checks = new Map()
  const add = (label, expr) => checks.set(label, expr)
  const table = n => `to_regclass(${q(qualified(n))})`
  const column = (n,c) => add(`column ${qualified(n)}.${c}`, `exists(select 1 from pg_attribute where attrelid=${table(n)} and attname=${q(c)} and attnum>0 and not attisdropped)`)
  const constraint = (n,c) => add(`constraint ${qualified(n)}.${c}`, `exists(select 1 from pg_constraint where conrelid=${table(n)} and conname=${q(c)})`)
  for (const m of sql.matchAll(new RegExp(`create\\s+schema\\s+(?:if not exists\\s+)?(${ident})`,'gi'))) add(`schema ${m[1]}`,`exists(select 1 from pg_namespace where nspname=${q(m[1])})`)
  for (const m of sql.matchAll(/create\s+extension\s+(?:if not exists\s+)?(\w+)/gi)) add(`extension ${m[1]}`,`exists(select 1 from pg_extension where extname=${q(m[1])})`)
  for (const m of sql.matchAll(new RegExp(`create\\s+table\\s+(?:if not exists\\s+)?(${ident})\\s*\\(([\\s\\S]*?)\\);`,'gi'))) {
    const n=m[1], bare=n.split('.').at(-1); add(`table ${qualified(n)}`,`${table(n)} is not null`)
    for (const item of parts(m[2])) {
      const c=item.trim().match(/^(\w+)\s/); if (!c) continue
      if (!/^(primary|unique|check|constraint|foreign)$/i.test(c[1])) column(n,c[1])
      if (/primary key/i.test(item)) constraint(n,`${bare}_pkey`)
      if (/^\s*unique\s*\(([^)]+)\)/i.test(item)) constraint(n,`${bare}_${item.match(/\(([^)]+)\)/)[1].replaceAll(/\s/g,'').replaceAll(',','_')}_key`)
      if (/references/i.test(item)) constraint(n,`${bare}_${c[1]}_fkey`)
      if (/generated\s+always\s+as\s+identity/i.test(item)) add(`sequence ${qualified(n)}_${c[1]}_seq`, `exists(select 1 from pg_sequence where seqrelid=to_regclass(${q(qualified(n)+'_'+c[1]+'_seq')}))`)
      if (/check\s*\(/i.test(item)) constraint(n,`${bare}_${c[1]}_check`)
    }
  }
  for (const stmt of sql.split(';')) {
    const t=stmt.match(new RegExp(`alter\\s+table\\s+(${ident})`,'i')); if (!t) continue
    for(const c of stmt.matchAll(/add\s+column\s+(?:if not exists\s+)?(\w+)/gi)) column(t[1],c[1])
    for(const c of stmt.matchAll(/alter\s+column\s+(\w+)\s+drop\s+not\s+null/gi)) add(`nullable ${t[1]}.${c[1]}`,`exists(select 1 from pg_attribute where attrelid=${table(t[1])} and attname=${q(c[1])} and not attnotnull and not attisdropped)`)
    for(const c of stmt.matchAll(/alter\s+column\s+(\w+)\s+set\s+default\s+(false|true)/gi)) add(`default ${t[1]}.${c[1]}=${c[2]}`,`exists(select 1 from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum where d.adrelid=${table(t[1])} and a.attname=${q(c[1])} and pg_get_expr(d.adbin,d.adrelid)=${q(c[2])})`)
    for(const c of stmt.matchAll(/add\s+constraint\s+(\w+)/gi)) constraint(t[1],c[1])
    if (/enable row level security/i.test(stmt)) add(`RLS ${t[1]}`,`exists(select 1 from pg_class where oid=${table(t[1])} and relrowsecurity)`)
  }
  for (const m of sql.matchAll(new RegExp(`create\\s+(?:or replace\\s+)?function\\s+(${ident})\\s*\\(([^)]*)\\)`,'gi'))) { const s=sig(m[1],m[2]); add(`function ${s}`,`to_regprocedure(${q(s)}) is not null`) }
  for (const m of sql.matchAll(new RegExp(`create\\s+(?:unique\\s+)?index\\s+(?:if not exists\\s+)?(${ident})\\s+on\\s+(${ident})`,'gi'))) add(`index ${m[1]}`,`to_regclass(${q(m[2].split('.')[0]+'.'+m[1])}) is not null`)
  for (const m of sql.matchAll(new RegExp(`create\\s+policy\\s+(?:"([^"]+)"|(\\w+))\\s+on\\s+(${ident})`,'gi'))) add(`policy ${m[3]}.${m[1]||m[2]}`,`exists(select 1 from pg_policy where polrelid=${table(m[3])} and polname=${q(m[1]||m[2])})`)
  for (const m of sql.matchAll(new RegExp(`create\\s+trigger\\s+(\\w+)[\\s\\S]*?\\bon\\s+(${ident})[\\s\\S]*?execute`,'gi'))) add(`trigger ${m[2]}.${m[1]}`,`exists(select 1 from pg_trigger where tgrelid=${table(m[2])} and tgname=${q(m[1])} and not tgisinternal)`)
  for (const m of sql.matchAll(new RegExp(`alter\\s+function\\s+(${ident})\\s*\\(([^)]*)\\)\\s+set\\s+search_path\\s*=\\s*([^;]+)`,'gi'))) {const s=sig(m[1],m[2]); add(`search_path ${s}`,`exists(select 1 from pg_proc where oid=to_regprocedure(${q(s)}) and ${q('search_path='+m[3].trim())}=any(proconfig))`) }
  for (const m of sql.matchAll(new RegExp(`(grant|revoke)\\s+([\\w, ]+)\\s+on\\s+(function|schema|table)?\\s*(${ident})(\\([^)]*\\))?\\s+(?:to|from)\\s+([\\w, ]+)`,'gi'))) {
    const grant=m[1].toLowerCase()==='grant', kind=(m[3]||'table').toLowerCase(), n=kind==='function'?sig(m[4],m[5].slice(1,-1)):kind==='schema'?m[4]:qualified(m[4])
    const privs=/all/i.test(m[2]) ? kind==='function'?['EXECUTE']:kind==='schema'?['USAGE','CREATE']:['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] : m[2].split(',').map(p=>p.trim().toUpperCase())
    for (const role of m[6].toLowerCase().split(',').map(s=>s.trim())) for(const priv of privs) {
      const catalog=kind==='function'?'pg_proc':kind==='schema'?'pg_namespace':'pg_class', acl=kind==='function'?'proacl':kind==='schema'?'nspacl':'relacl', owner=kind==='function'?'proowner':kind==='schema'?'nspowner':'relowner'
      const oid=kind==='function'?`to_regprocedure(${q(n)})`:kind==='schema'?`(select oid from pg_namespace where nspname=${q(n)})`:`to_regclass(${q(n)})`
      const effective=role==='public'?`exists(select 1 from aclexplode(coalesce(o.${acl},acldefault(${q(kind==='function'?'f':kind==='schema'?'n':'r')},o.${owner}))) a where a.grantee=0 and a.privilege_type=${q(priv)})`:`case when exists(select 1 from pg_roles where rolname=${q(role)}) then has_${kind}_privilege(${q(role)},o.oid,${q(priv)}) else false end`
      add(`ACL ${kind} ${n} ${role} ${priv}`,`exists(select 1 from ${catalog} o where o.oid=${oid} and (${effective})=${grant})`)
    }
  }
  for(const m of sql.matchAll(new RegExp(`alter publication (\\w+) add table (${ident})`,'gi'))) add(`publication ${m[1]} ${m[2]}`,`exists(select 1 from pg_publication_tables where pubname=${q(m[1])} and schemaname=${q(m[2].split('.')[0])} and tablename=${q(m[2].split('.')[1])})`)
  if (/storage\.buckets/.test(sql)) add('bucket avatars',"exists(select 1 from storage.buckets where id='avatars')")
  for(const [label,expr] of checks) rows.push(`select ${q(file)} as "миграция", ${q(label)} as "объект", case when coalesce((${expr}),false) then 'есть' else 'нет' end as "есть/нет"`)
}
fs.writeFileSync('check-migrations.sql', '-- Read-only inventory of all migration-created objects and expected ACLs.\n-- Run as postgres/owner to inspect all catalogs. No application functions are called.\n-- Existence is NOT proof of migration application or function/policy body equivalence.\n-- Historical policies/ACLs superseded by later migrations may report нет.\n-- Seed rows are intentionally excluded; storage bucket configuration is not compared.\n'+rows.join('\nunion all\n')+'\norder by 1,2;\n')
console.log(`${rows.length} catalog checks generated`)
