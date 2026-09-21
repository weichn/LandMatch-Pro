# LandMatch Office

獨立的事務所工作台，使用 Supabase 專案 `qkwfulonscvreudtroaw`。原媒合網站與根目錄應用不變。

## 開發

使用 Node.js 22.12 以上版本，在此目錄執行：

```sh
npm ci
npm run dev
npm run build
```

建置結果在 `dist/`，可部署為獨立靜態網站。若透過 Vercel Git integration 部署，請建立另一個專案、Root Directory 設為 `office`、Framework 設為 Vite。不要把既有媒合網站的 Root Directory 改成此目錄。

## 使用流程

1. 註冊或登入 Office 帳號。目前專案 Email 自動確認已開啟；若未來啟用驗證信，需依信件指示完成驗證。
2. 尚無任何成員資格的已驗證帳號可建立自己的第一間事務所。
3. 管理案件、聯絡人、往來組織及事務所基本資料。

Office 採獨立登入儲存鍵 `landmatch-office-auth-v1`；相同 Supabase 專案的 Auth 身分可能共用，但不會自動沿用媒合網站的瀏覽器登入狀態。既有 Supabase Auth 設定為 `mailer_autoconfirm=true`，未改動此設定。資料庫的 `email_confirmed_at` 檢查不代表已確認信箱所有權。驗證信送達未測試。本版沒有重設密碼、邀請成員或角色管理介面。

## 安全與資料庫

- 用戶端只有公開 publishable key，沒有 service-role key 或資料庫密碼。
- 所有資料庫存取仍由 RLS 決定；UI 的按鈕顯示不是授權依據。
- 異動指定事務所及資料 ID；修改／刪除比對 `updated_at`，避免覆蓋他人的更新。
- 使用明確欄位白名單；不讀取、不輸入身分證欄位。敏感欄位加密與金鑰管理尚未實作。
- `database/bootstrap.sql` 為已套用的 `office_first_office_bootstrap` migration 內容，建立第一間事務所的 RPC。需要先存在 Phase 1 五張表及 `office_private` schema。不要當作前端啟動腳本重複執行。
- bootstrap 驗證已確認且未停權的 Auth 身分，不接受任意使用者或角色；交易鎖及冪等回傳避免重複建立。已有成員資格的帳號不能透過此 RPC 自行新增事務所。
- `database/bootstrap.test.sql` 在交易內建立測試資料並回滾，16 項檢查通過。
- Phase 1 的 150 項資料庫測試在加入 bootstrap 後全部通過，涵蓋未登入、非成員、跨事務所、停權成員與角色權限。

## 已驗證（2026-09-18）

- 獨立依賴安裝、Vite 正式建置與 React ESLint 檢查通過；本工作台依賴 audit 為 0 個已知漏洞。
- 瀏覽器實際登入、建立事務所、建立聯絡人／組織／關聯案件、更新進度；線上部署登入後讀到已保存資料。
- 使用專用測試帳號，不向真實使用者寄送測試郵件。
- 安全 advisors 未新增資料庫警告；既有 leaked password protection 未啟用警告仍須由專案管理者處理。

不包含第二批 `case_parties`、`properties` 等資料表；不修改舊 `agents`、`cases`、`transactions`、`visits`。

## 交付（2026-09-21）

正式公開入口：https://landmatch-office.vercel.app/ 。使用未登入 Vercel 的 HTTP 請求確認回傳工作台 HTML（200）。較長的部署 alias 受 Vercel 登入保護，不應作為使用者入口。

全部專用測試資料與測試帳號已清除。GitHub connector 回傳 403 Resource not accessible by integration，未建立遠端分支或 PR；程式以原始碼壓縮檔交付。
