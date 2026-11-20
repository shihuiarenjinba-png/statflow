function cleanHeader(v, index, used) {
  const base=String(v ?? "").trim().replace(/\s+/g," ") || `Column_${index+1}`;
  let out=base, n=2;
  while (used.has(out)) out=`${base}_${n++}`;
  used.add(out);
  return out;
}

function parsePlainNumber(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s=String(v ?? "").trim();
  if (!s || /%$/.test(s)) return null;
  if (!/^[+-]?(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(s)) return null;
  const n=Number(s.replaceAll(",",""));
  return Number.isFinite(n) ? n : null;
}

function parseIsoDate(v) {
  const s=String(v ?? "").trim();
  if (!/^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}$/.test(s)) return null;
  const [y,m,d]=s.split(/[\/-]/).map(Number);
  const date=new Date(Date.UTC(y,m-1,d));
  if (date.getUTCFullYear()!==y || date.getUTCMonth()!==m-1 || date.getUTCDate()!==d) return null;
  return `${String(y).padStart(4,"0")}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

export function canonicalizeTable(rawRows) {
  const nonEmpty=rawRows.filter(r=>Array.isArray(r) && r.some(v=>String(v ?? "").trim()!==""));
  if (nonEmpty.length < 2) throw new Error("ヘッダーと1行以上のデータが必要です。");
  const width=Math.max(...nonEmpty.map(r=>r.length));
  const used=new Set();
  const headers=Array.from({length:width},(_,i)=>cleanHeader(nonEmpty[0][i],i,used));
  const audit=[];
  headers.forEach((h,i)=>{
    const original=String(nonEmpty[0][i] ?? "");
    if (h!==original) audit.push({type:"header_normalized", column:h, from:original, to:h});
  });

  const body=nonEmpty.slice(1).map((r,rowIndex)=>{
    const obj={};
    headers.forEach((h,i)=>{
      const raw=r[i] ?? "";
      if (typeof raw === "string") {
        const trimmed=raw.trim();
        if (trimmed!==raw) audit.push({type:"trimmed", row:rowIndex+1, column:h});
        obj[h]=trimmed==="" ? null : trimmed;
      } else obj[h]=raw ?? null;
    });
    return obj;
  });

  const columns=headers.map(name=>{
    const values=body.map(r=>r[name]).filter(v=>v!==null);
    const numeric=values.map(parsePlainNumber);
    const numericRate=values.length ? numeric.filter(v=>v!==null).length/values.length : 0;
    const dates=values.map(parseIsoDate);
    const dateRate=values.length ? dates.filter(Boolean).length/values.length : 0;
    let kind="categorical";
    if (numericRate>=0.9) kind="numeric";
    else if (dateRate>=0.9) kind="date";
    const lower=name.toLowerCase();
    const unique=new Set(values.map(v=>String(v))).size;
    if (kind==="categorical" && values.length>0 && unique===values.length && /(id|code|key|番号|識別)/i.test(lower)) kind="id";
    return {
      name,
      kind,
      nonNull:values.length,
      unique,
      parseConfidence:kind==="numeric" ? numericRate : kind==="date" ? dateRate : 1
    };
  });

  body.forEach((row,rowIndex)=>{
    for (const c of columns) {
      const v=row[c.name];
      if (v===null) continue;
      if (c.kind==="numeric") {
        const n=parsePlainNumber(v);
        if (n!==null) {
          if (n!==v) audit.push({type:"numeric_parsed",row:rowIndex+1,column:c.name});
          row[c.name]=n;
        } else {
          audit.push({type:"numeric_parse_failed",row:rowIndex+1,column:c.name,value:String(v)});
        }
      } else if (c.kind==="date") {
        const d=parseIsoDate(v);
        if (d) {
          if (d!==v) audit.push({type:"date_normalized",row:rowIndex+1,column:c.name});
          row[c.name]=d;
        } else {
          audit.push({type:"date_parse_failed",row:rowIndex+1,column:c.name,value:String(v)});
        }
      }
    }
  });

  return {
    contractVersion:"1.1",
    columns,
    rows:body,
    audit,
    meta:{rowCount:body.length,columnCount:columns.length},
    kinds:Object.fromEntries(columns.map(c=>[c.name,c.kind]))
  };
}

export const numericColumns = ds => ds.columns.filter(c=>c.kind==="numeric").map(c=>c.name);
export const categoricalColumns = ds => ds.columns.filter(c=>["categorical","id"].includes(c.kind)).map(c=>c.name);
