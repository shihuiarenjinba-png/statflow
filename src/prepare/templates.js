export const PREPARE_TEMPLATES=[
  {
    id:"standard",
    label:"標準テーブル",
    description:"1行目が列名、1行=1観測の通常データ。安全な整形のみ行います。"
  },
  {
    id:"metadata_header",
    label:"先頭に説明行がある表",
    description:"タイトルや注記の後ろに見出しがある表。見出し行番号を明示指定して読み直します。"
  },
  {
    id:"two_row_header",
    label:"2段見出し",
    description:"上位見出しと下位見出しを「上位 / 下位」として連結してからCanonical Datasetへ変換します。"
  },
  {
    id:"transposed",
    label:"転置テーブル",
    description:"変数が行方向に並ぶ表を明示的に転置してからCanonical Datasetへ変換します。"
  },
  {
    id:"panel",
    label:"時系列パネル",
    description:"ID×時点を複合キーとして扱う企業・店舗・患者などのパネルデータ向けです。"
  },
  {
    id:"market_panel",
    label:"市場/株価パネル（安全）",
    description:"銘柄ID×日付を基本キーとし、inner joinを既定禁止。基準ユニバースから消えた銘柄を欠損のまま保持します。"
  },
  {
    id:"multi_file_lookup",
    label:"複数ファイル属性結合",
    description:"共通IDでマスタ/属性ファイルをleft joinします。キー重複があれば停止します。"
  }
];

export function templateDefaults(id) {
  switch(id) {
    case "metadata_header": return {transpose:false,headerRow:2,combineHeaderRows:1};
    case "two_row_header": return {transpose:false,headerRow:1,combineHeaderRows:2};
    case "transposed": return {transpose:true,headerRow:1,combineHeaderRows:1};
    case "panel": return {join:{how:"left",marketSafe:false,requireCompositeKey:true}};
    case "market_panel": return {join:{how:"left",marketSafe:true,requireCompositeKey:true}};
    case "multi_file_lookup": return {join:{how:"left",marketSafe:false,requireCompositeKey:false}};
    default: return {transpose:false,headerRow:1,combineHeaderRows:1};
  }
}
