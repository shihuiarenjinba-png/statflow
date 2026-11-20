import { auditMarketUniverse } from "./market.js";

function hasCompleteKey(row, keys) {
  return keys.every(k => row[k] !== null && row[k] !== undefined && String(row[k]).trim() !== "");
}

function keyOf(row, keys) {
  return keys.map(k => String(row[k])).join("\u241F");
}

function assertKeys(ds, keys, label) {
  const names=new Set(ds.columns.map(c=>c.name));
  for(const key of keys) {
    if(!names.has(key)) throw new Error(label + " に結合キー " + key + " がありません。");
  }
}

function duplicateKeyReport(ds, keys) {
  const seen=new Map();
  let missingKeyRows=0;
  for(const row of ds.rows) {
    if(!hasCompleteKey(row,keys)) { missingKeyRows++; continue; }
    const k=keyOf(row,keys);
    seen.set(k,(seen.get(k)||0)+1);
  }
  const duplicateKeys=[...seen.entries()].filter(([,n])=>n>1);
  return {duplicateKeyCount:duplicateKeys.length,duplicateRows:duplicateKeys.reduce((s,[,n])=>s+n-1,0),missingKeyRows};
}

function renamedColumns(left,right,keys,suffix) {
  const leftNames=new Set(left.columns.map(c=>c.name));
  const mapping={};
  for(const c of right.columns) {
    if(keys.includes(c.name)) continue;
    mapping[c.name]=leftNames.has(c.name) ? c.name + suffix : c.name;
  }
  return mapping;
}

export function detectCommonKeys(datasets) {
  if(!datasets?.length) return [];
  const common=new Set(datasets[0].columns.map(c=>c.name));
  for(const ds of datasets.slice(1)) {
    const names=new Set(ds.columns.map(c=>c.name));
    for(const key of [...common]) if(!names.has(key)) common.delete(key);
  }
  return [...common];
}

export function joinDatasets(left,right,options={}) {
  const keys=options.keys||[];
  const how=options.how||"left";
  const suffix=options.suffix||"_right";
  const marketSafe=Boolean(options.marketSafe);
  const allowSurvivorshipRisk=Boolean(options.allowSurvivorshipRisk);
  const pointInTimeUniverseVerified=Boolean(options.pointInTimeUniverseVerified);

  if(!keys.length) throw new Error("結合キーを1つ以上指定してください。");
  assertKeys(left,keys,"基準データ");
  assertKeys(right,keys,"追加データ");

  if(!["left","outer","inner"].includes(how)) throw new Error("join type は left / outer / inner のみ対応しています。");
  if(marketSafe && how==="inner" && !allowSurvivorshipRisk) {
    throw new Error("市場データ安全モードでは inner join を既定で禁止します。共通銘柄だけを残すとサバイバーシップ/上場銘柄選択バイアスを生む可能性があります。");
  }

  const leftDup=duplicateKeyReport(left,keys), rightDup=duplicateKeyReport(right,keys);
  if(leftDup.duplicateKeyCount || rightDup.duplicateKeyCount) {
    throw new Error("結合キーが一意ではありません。many-to-many結合による行数爆発を防ぐため停止しました。集約またはキー追加が必要です。");
  }

  const rightMap=new Map(right.rows.filter(r=>hasCompleteKey(r,keys)).map(r=>[keyOf(r,keys),r]));
  const leftMap=new Map(left.rows.filter(r=>hasCompleteKey(r,keys)).map(r=>[keyOf(r,keys),r]));
  const mapping=renamedColumns(left,right,keys,suffix);
  const rows=[];
  let matched=0,leftOnly=0,rightOnly=0;

  for(const l of left.rows) {
    const complete=hasCompleteKey(l,keys);
    const k=complete?keyOf(l,keys):null, r=complete?rightMap.get(k):undefined;
    const out={...l};
    for(const [source,target] of Object.entries(mapping)) out[target]=r ? r[source] : null;
    if(r) matched++; else leftOnly++;
    if(r || how!=="inner") rows.push(out);
  }

  if(how==="outer") {
    for(const r of right.rows) {
      if(!hasCompleteKey(r,keys)) { rightOnly++; continue; }
      const k=keyOf(r,keys);
      if(leftMap.has(k)) continue;
      rightOnly++;
      const out={};
      for(const c of left.columns) out[c.name]=keys.includes(c.name) ? r[c.name] : null;
      for(const [source,target] of Object.entries(mapping)) out[target]=r[source];
      rows.push(out);
    }
  } else {
    for(const r of right.rows) if(!hasCompleteKey(r,keys) || !leftMap.has(keyOf(r,keys))) rightOnly++;
  }

  const rightColumnByName=Object.fromEntries(right.columns.map(c=>[c.name,c]));
  const columns=[
    ...left.columns,
    ...Object.entries(mapping).map(([source,target])=>({...rightColumnByName[source],name:target,joinedFrom:source}))
  ];
  const marketAudit=marketSafe?auditMarketUniverse(left,keys,{pointInTimeUniverseVerified}):null;
  const report={
    how,keys,marketSafe,marketAudit,
    leftRows:left.rows.length,rightRows:right.rows.length,resultRows:rows.length,
    matched,leftOnly,rightOnly,
    missingKeyRows:{left:leftDup.missingKeyRows,right:rightDup.missingKeyRows},
    rowRetention:left.rows.length ? rows.length/left.rows.length : 0,
    warnings:[]
  };
  if(marketAudit?.warnings?.length) report.warnings.push(...marketAudit.warnings);
  if(leftDup.missingKeyRows || rightDup.missingKeyRows) report.warnings.push("結合キー欠損行は一致扱いにせず、未一致として処理しました。");
  if(how==="inner" && leftOnly>0) report.warnings.push("inner join により基準データの行が脱落しました。");
  if(marketSafe && leftOnly>0) report.warnings.push("追加データに存在しない銘柄/時点があります。欠損として保持し、標本から自動除外しないでください。");
  if(marketSafe && keys.length<2) report.warnings.push("市場パネルでは通常、銘柄IDと時点の複合キーが必要です。単一キー結合は要確認です。");

  return {
    ...left,
    rows,columns,
    kinds:Object.fromEntries(columns.map(c=>[c.name,c.kind])),
    meta:{...left.meta,rowCount:rows.length,columnCount:columns.length},
    audit:[...left.audit,{type:"dataset_join",how,keys,marketSafe,report}],
    prepareReport:report
  };
}

export function joinMany(datasets,options={}) {
  if(!datasets?.length) throw new Error("結合対象データがありません。");
  let out=datasets[0];
  const reports=[];
  for(let i=1;i<datasets.length;i++) {
    out=joinDatasets(out,datasets[i],options);
    reports.push(out.prepareReport);
  }
  return {...out,prepareReports:reports};
}
