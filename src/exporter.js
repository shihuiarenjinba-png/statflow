function csvCell(v){
  if(v===null||v===undefined) return "";
  const s=String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s;
}

export function canonicalCsv(ds){
  const names=ds.columns.map(c=>c.name);
  return [names.map(csvCell).join(","),...ds.rows.map(r=>names.map(n=>csvCell(r[n])).join(","))].join("\n");
}

export function downloadText(text,name,type="text/plain"){
  const blob=new Blob([text],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),500);
}
