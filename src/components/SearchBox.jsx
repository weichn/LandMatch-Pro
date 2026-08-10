function SearchBox() {
  return (
    <section className="search-box">
      <h2>🔍 找到適合您的地政士</h2>

      <p>請選擇您的地區與需要協助的服務項目</p>

      <select defaultValue="">
        <option value="" disabled>
          📍 選擇縣市
        </option>

        <option>基隆市</option>
        <option>臺北市</option>
        <option>新北市</option>
        <option>桃園市</option>
        <option>新竹市</option>
        <option>新竹縣</option>
        <option>苗栗縣</option>
        <option>臺中市</option>
        <option>彰化縣</option>
        <option>南投縣</option>
        <option>雲林縣</option>
        <option>嘉義市</option>
        <option>嘉義縣</option>
        <option>臺南市</option>
        <option>高雄市</option>
        <option>屏東縣</option>
        <option>宜蘭縣</option>
        <option>花蓮縣</option>
        <option>臺東縣</option>
        <option>澎湖縣</option>
        <option>金門縣</option>
        <option>連江縣</option>
      </select>

      <select defaultValue="">
        <option value="" disabled>
          📄 選擇服務項目
        </option>

        <option>不動產買賣過戶</option>
        <option>房屋贈與過戶</option>
        <option>遺產繼承登記</option>
        <option>遺產分割協議</option>
        <option>夫妻贈與</option>
        <option>土地／建物所有權移轉</option>
        <option>土地分割、合併</option>
        <option>土地持分移轉</option>
        <option>信託登記</option>
        <option>銀行抵押權設定</option>
        <option>民間抵押權設定</option>
        <option>抵押權塗銷</option>
        <option>最高限額抵押權設定</option>
        <option>預告登記</option>
        <option>查封／假扣押登記</option>
        <option>實價登錄申報</option>
        <option>租賃相關登記</option>
        <option>地上權登記</option>
        <option>農地移轉與農地贈與</option>
        <option>共有物分割</option>
        <option>更正登記／限制登記</option>
        <option>地政資料申請與謄本調閱</option>
        <option>其他地政相關服務</option>
      </select>

      <button type="button">🔍 開始搜尋</button>
    </section>
  );
}

export default SearchBox;