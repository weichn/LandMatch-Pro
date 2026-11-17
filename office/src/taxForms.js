export const taxFormSources = [
  {id:'tax-national-local-portal',provider:'財政部地方稅網路申報作業入口網（全國）',url:'https://net.tax.nat.gov.tw'},
  {id:'tax-etax-gift',provider:'財政部稅務入口網',url:'https://www.etax.nat.gov.tw/etwmain/etw212w/detail/5514739763731973674'},
  {id:'tax-etax-estate',provider:'財政部稅務入口網',url:'https://www.etax.nat.gov.tw/etwmain/etw212w/detail/6720691758336777465'},
  {id:'tax-ntbt-gift',provider:'財政部臺北國稅局',url:'https://www.ntbt.gov.tw/singlehtml/efaf48a7e921476db318c12ba5eed468?cntId=3830eb6465b14c03a330bfa304f4135e'},
  {id:'tax-ntbt-estate',provider:'財政部臺北國稅局',url:'https://www.ntbt.gov.tw/singlehtml/efaf48a7e921476db318c12ba5eed468?cntId=61d830fb25db401cb6948d60e2df26cb'},
  {id:'local-tax-deed',provider:'新北市政府稅捐稽徵處',url:'https://www.tax.ntpc.gov.tw/sp-onap-cont-67-11da0-1.html'},
  {id:'local-tax-land-value',provider:'新北市政府稅捐稽徵處',url:'https://www.tax.ntpc.gov.tw/cp-1038-13796-a83f2-1.html'},
  {id:'local-tax-self-use-land',provider:'新北市政府稅捐稽徵處',url:'https://www.tax.ntpc.gov.tw/sp-onap-flist-51-88e39-1.html'},
];

const record=(id,label,category,context,provider,sourceUrl,notes=[])=>({
  id,label,category,context,provider,variant:'blank',sourceUrl,pdfUrl:null,odtUrl:null,docUrl:null,localFile:null,availability:'official-source',notes,
});
const sourceUrl=id=>taxFormSources.find(source=>source.id===id).url;

export const taxForms=[
  record('etax-gift-return','贈與稅申報書及檢核表（中文空白）','國稅','贈與','財政部稅務入口網',sourceUrl('tax-etax-gift'),['空白表、填寫範例及申報說明請至財政部稅務入口網下載。']),
  record('ntbt-gift-contract','贈與契約書（國稅申報用）','國稅','贈與','財政部臺北國稅局',sourceUrl('tax-ntbt-gift'),['官方頁面提供空白表、範例及可編輯格式。']),
  record('ntbt-gift-burden','贈與附有負擔切結書','國稅','贈與','財政部臺北國稅局',sourceUrl('tax-ntbt-gift')),
  record('ntbt-sale-payment','買賣資金收付情形分析表','國稅','買賣、親屬間買賣','財政部臺北國稅局',sourceUrl('tax-ntbt-gift'),['親屬間買賣或國稅局要求時使用。']),
  record('etax-estate-return','遺產稅申報書及檢核表（中文空白）','國稅','繼承','財政部稅務入口網',sourceUrl('tax-etax-estate'),['空白表、填寫範例及申報說明請至財政部稅務入口網下載。']),
  record('ntbt-estate-checklist','遺產項目自我檢查表','國稅','繼承','財政部臺北國稅局',sourceUrl('tax-ntbt-estate')),
  record('ntbt-estate-spousal','生存配偶剩餘財產差額分配請求權計算表','國稅','繼承','財政部臺北國稅局',sourceUrl('tax-ntbt-estate')),
  record('ntbt-estate-certificate','遺產稅、贈與稅各項證明書副本申請書','國稅','繼承、贈與','財政部臺北國稅局',sourceUrl('tax-ntbt-estate')),
  record('ntpc-deed-tax-return','契稅申報書','地方稅','買賣、贈與、分割、建物移轉','新北市政府稅捐稽徵處',sourceUrl('local-tax-deed'),['此為新北市官方表單；其他縣市請由上方全國入口或標的所在地稅捐處下載最新版。']),
  record('ntpc-deed-tax-statement','契稅申報聲明事項表','地方稅','買賣、贈與、分割、建物移轉','新北市政府稅捐稽徵處',sourceUrl('local-tax-deed'),['此為新北市版本；如案件情形符合，請依稅捐機關要求檢附。']),
  record('ntpc-land-value-return','土地增值稅（土地現值）申報書','地方稅','買賣、贈與、共有物分割、分割、合併','新北市政府稅捐稽徵處','https://www.tax.ntpc.gov.tw/sp-onap-fdl-3056-2640dbbbc9f847dcb88b39e362cc1d84.html',['此為新北市官方表單；其他縣市請由上方全國入口或標的所在地稅捐處下載最新版。']),
  record('ntpc-self-use-land','土地增值稅自用住宅用地申明及適用順序相關書表','地方稅','買賣、自用住宅','新北市政府稅捐稽徵處',sourceUrl('local-tax-self-use-land'),['含土地所有權人及設籍人申明書、適用順序申明書；是否適用請洽土地所在地稅捐機關。']),
];
