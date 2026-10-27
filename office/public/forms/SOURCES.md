# LandMatch Office 官方書表及字型來源

## 2026-10-27 書表擴充

贈與及繼承書表依新竹市地政事務所的官方目錄加入；本地檔保留原頁面與版式，套印前不改寫官方文字。贈與原稿為兩頁 A4 橫式，繼承系統表為一頁 A4 直式，遺產分割協議書原稿即為一頁 A3 直式。

| 本地檔 | 官方空白原檔 | SHA-256 |
| --- | --- | --- |
| gift.pdf | [土地建築改良物所有權贈與移轉契約書](https://landeasy.hccg.gov.tw/archive/土地建築改良物所有權贈與移轉契約書%283%29.pdf) | d5d66d5c4f9e315bcb0b9ecbb960d939da760f41b8d79294084da6d6f8ef0ece |
| inheritance-tree.pdf | [繼承系統表](https://landeasy.hccg.gov.tw/archive/繼承系統表%281%29.pdf) | 495f7735da3a96ba1ee9942b0862449c9cf5585b127777ea2c45840943b8041b |
| inheritance-partition.pdf | [遺產分割協議書](https://landeasy.hccg.gov.tw/archive/遺產分割協議書%281%29.pdf) | 8575829a435099d71d75b110c922fdd7316458a28cabf8ab68f89a45d086957a |

官方書表庫另完整收錄新北市樹林地政事務所各類申請書表、新竹市地政小幫手應備文件查詢兩個目錄的 129 個來源項目：80 個空白書表項目、27 個範例、22 個說明（含不同機關及情境版本）。可用 PDF 空白來源 39 個，依 SHA-256 去重為 24 份本地原檔；下載網址、雜湊、頁數、尺寸及旋轉記錄見 `library/SOURCES.json`，不宣稱涵蓋全臺每個機關的全部地方專用表格。ODT、Word 與 ODS 保留官方下載連結，未偽稱已轉成 PDF。

其中官方目錄「抵押權塗銷登記／登記清冊」PDF 連結實際指向已填寫範例，已在書表庫列為範例並註明原目錄誤鏈，不列入空白本地檔。

A3 輸出僅處理列印版面：相鄰橫式頁依原順序上下合併；直式頁使用完整單張 A3，原 A3 直式不縮成半張。保留 CropBox 與旋轉，等比置中不裁切；含不可靠互動欄位或註記的 PDF 拒絕合併，仍可下載官方原版。

繼承系統表使用官方固定的配偶、長次三子女欄位，僅對使用者明確指定的親屬關係套印，不推定繼承資格或持分。其他親屬／代位系統請選合適的官方空白表。協議書的分配文字由使用者逐標的填寫；簽名、蓋章及申請人簽署欄留空。

下載與核對日期：2026-10-26（Asia/Taipei）。本紀錄對應本目錄所附檔案；官方網站之後更新書表時，應重新下載、比對版本與套印位置。

## 官方書表

來源機關為新竹市地政事務所。下列三個直接下載網址均由其[應備文件快速查詢](https://www.landhc.gov.tw/content/index.php?parent_id=10810&type_id=10810)頁面的「登記申請書下載／契約書下載」連結確認。該所另提供[地政小幫手官方書表目錄](https://landeasy.hccg.gov.tw/content/?mode=data&parent_id=273)，其中包含空白 PDF、DOC、ODT，以及填寫說明與範例。

2026-10-26 重新讀取以下三個下載網址，取得的位元組數及 SHA-256 均與本地原始檔相符；下載內容為空白書表，並非範例填寫文件。

| 本地原始檔 | 官方名稱及表號 | 頁數 | 位元組數 | 官方下載網址 |
| --- | --- | ---: | ---: | --- |
| `application.pdf` | 土地登記申請書 S0700000200-1 | 2 | 103466 | [原始 PDF](https://www.landhc.gov.tw/archive/file/土地登記申請書%2824%29.pdf) |
| `sale.pdf` | 土地／建築改良物所有權買賣移轉契約書 S0700000203 | 2 | 120359 | [原始 PDF](https://www.landhc.gov.tw/archive/file/土地建築改良物所有權買賣移轉契約書%281%29.pdf) |
| `mortgage.pdf` | 土地、建築改良物抵押權設定契約書 S0700000212 | 2 | 122610 | [原始 PDF](https://www.landhc.gov.tw/archive/file/土地建築改良物抵押權設定契約書%281%29.pdf) |

### SHA-256

```text
6c912319af081085b37eb1ca9ddbb5b497394121d4fd1a5165b6113797deaf70  application.pdf
6a4be658bd37d21689faeb9f806b8c354858c3e7926d0384f18b065e2c13373f  application-normalized.pdf
7e5bc11fb6184e48b7f155cb2df4065a05cc16b15a6797b7c41d391659d96fd3  sale.pdf
3460828193aeacc0712d78c2e226189c88625aaa1c66443fc0da5846263c00b3  mortgage.pdf
ff782d4208c59ca68351da4a44d24c3825e0b9510f345ea338953cdc8b2b2bbc  NotoSerifTC-Regular.ttf
5e0da210fb04058a8c0087985d2d456b931c2579811a49655721d3cf0c36b6d6  FONT-LICENSE.txt
```

### 申請書旋轉正規化

`application-normalized.pdf` 是 LandMatch Office 為套印製作的本地衍生檔，不是另一份官方下載檔。官方 `application.pdf` 的兩頁 MediaBox 均為 595.22 × 842.00 PDF point，並帶有 `/Rotate 90`；顯示結果為橫式。正規化檔將旋轉轉入頁面內容，兩頁 MediaBox 改為 842.00 × 595.22 point，`/Rotate 0`。原始官方檔另外保留，供使用者查看及後續版本比對。

買賣與抵押原始檔兩頁的 MediaBox 均為 842.04 × 595.32 point，`/Rotate 0`。這些數值是對下載檔的技術量測，表示 PDF 自身約為 A4 橫式，不等於受理機關對實際紙張、正副本、單雙面或裝訂的統一規定。

## 官方填寫及印製說明

下列說明保留各來源的適用範圍，不由 PDF 尺寸推定全臺地政事務所的受理要求。

- 新竹市地政事務所[買賣移轉契約書填寫說明](https://www.landhc.gov.tw/archive/file/土地建築改良物所有權買賣移轉契約書填寫說明%281%29.pdf)容許電腦打字。空白欄應劃除或標示以下空白，欄位不敷使用時可另附相同格式清冊並於騎縫處蓋章。此說明分別涵蓋土地、建築改良物，以及土地建築改良物三種買賣移轉契約書。
- 新竹市地政事務所[抵押權設定契約書填寫說明](https://www.landhc.gov.tw/archive/file/土地建築改良物抵押權設定契約書填寫說明%283%29.pdf)亦容許電腦打字，並說明空白欄及續附相同格式清冊的處理。普通與最高限額抵押權使用同一張官方契約書，以表頭選項區分。
- 雲林縣稅務局[線上代書申報 Easy go](https://www.yltb.gov.tw/ScrivenerlandGo.aspx?n=6904&name=9986DEA1438812B2146E3A6801E5708B&sms=0)對其「買賣移轉契約書」列印選項，明示 A4 橫式列印，並要求申報時契約書騎縫處加蓋雙方印章。這是該稅務申報服務的公開指示，不代表已確認所有地政機關採相同受理方式。
- 臺北市法規查詢系統所保存之[民國98年12月16日抵押權設定登記申請須知版本](https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL003399?date=20091216)，記載其提供書表為 A3 格式，使用 A4 紙張時兩頁間應由全體申請人加蓋騎縫章。此連結是歷史版本，只作為官方曾明示紙張及騎縫要求的可追溯紀錄；不得當成已確認的全臺現行統一規定。

本次在新竹市上述原始檔、目錄及填寫說明中，未確認到針對這三份下載檔一律強制 A3、A4、單面或雙面的明示要求。實際使用時仍應核對受理機關要求的紙張、正副本、裝訂、簽章與附件。

## 字型來源及授權

本地 `NotoSerifTC-Regular.ttf` 用於 PDF 內嵌繁體中文字型。2026-10-26 從 [Google Fonts 官方字型檔](https://raw.githubusercontent.com/google/fonts/main/ofl/notoseriftc/NotoSerifTC%5Bwght%5D.ttf)重新下載 Noto Serif TC 可變字型，保存於工作區 `artifacts/registration-qa/NotoSerifTC-variable.ttf`，其 SHA-256 為 `0077e18f57c6908f4a000969880940bdb0dad057c0e8d98b49dc364c3d1b09c6`。

本地靜態 Regular 檔由該可變字型使用 fontTools 的 `fontTools.varLib.instancer.instantiateVariableFont(font, {"wght": 400}, inplace=True, updateFontNames=True)` 實體化後儲存。這是上游字型的本地靜態衍生檔，不宣稱與另一次轉換輸出的位元組必然相同；本次實際產物以本文件 SHA-256 表為準。

本次直接讀取輸出字型的 name table、OS/2 及 fvar table，核對得到：

- Family：`Noto Serif TC`；Full name：`Noto Serif TC Regular`。
- Subfamily：`Regular`；PostScript name：`NotoSerifTC-Regular`。
- Version：`Version 2.003-H1;hotconv 1.1.1;makeotfexe 2.6.0`。
- Copyright：`(c) 2017-2024 Adobe (http://www.adobe.com/).`。
- `OS/2.usWeightClass` 為 400，且無 fvar table；此本地檔為靜態 Regular 字型，大小為 10003632 位元組。
- 字型內嵌的授權描述為 SIL Open Font License 1.1，授權網址為 <https://openfontlicense.org>；內嵌供應商網址為 <https://fonts.google.com/noto>。

上游核對入口為 [Google Fonts Noto Serif TC](https://github.com/google/fonts/tree/main/ofl/notoseriftc)及 [Noto CJK 官方倉庫](https://github.com/notofonts/noto-cjk)。

`FONT-LICENSE.txt` 於同日從 [Google Fonts 同目錄的官方 OFL.txt](https://raw.githubusercontent.com/google/fonts/main/ofl/notoseriftc/OFL.txt)下載，隨檔保留 SIL Open Font License 1.1 全文；該授權容許依條件散布及內嵌字型。上游 OFL.txt 前言為 Copyright 2012 Google Inc.，字型 name table 另保留上述 2017–2024 Adobe 聲明。兩份上游聲明均予保留，不以授權文字檔的前言取代字型內部權利人資訊。字型版本、內部名稱及 SHA-256 變更時，應同時更新本來源紀錄與對應授權資訊。
