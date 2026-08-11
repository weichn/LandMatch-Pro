function HomeHero() {
  function scrollToDemandForm() {
    document.querySelector(".demand-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <section className="home-hero">
      <div className="hero-tag">
        ● 全台地政士公開媒合 ・ 民眾免費發布需求
      </div>

      <h2>
        辦過戶、報稅、繼承登記，
        <br />
        銀行／民間抵押設定，安心找到專業協助。
      </h2>

      <p className="hero-description">
        發出您的案件需求，多位地政士可主動申請媒合；
        <br />
        平台核准後才能私聊，讓每一次聯繫都有保障。
      </p>

      <p className="hero-note">
        🔗 地政士免費登錄，核准後贈送 10 點作為媒合額度
      </p>

      <div className="hero-actions">
        <button type="button" onClick={scrollToDemandForm}>
          免費發出我的案件需求
        </button>
      </div>

      <div className="hero-steps">
        <p className="hero-steps-title">運作方式</p>

        <h3>公開發案，多位地政士主動回覆</h3>

        <div className="hero-step-grid">
          <div>
            <span>STEP 01</span>
            <h4>發出案件需求</h4>
            <p>填寫基本資料與案件問題，真實聯繫方式不會公開。</p>
          </div>

          <div>
            <span>STEP 02</span>
            <h4>地政士申請媒合</h4>
            <p>案件公開後，核准地政士可使用點數申請協助。</p>
          </div>

          <div>
            <span>STEP 03</span>
            <h4>平台核准後私聊</h4>
            <p>媒合核准後才開啟對話，雙方可安心討論需求。</p>
          </div>
        </div>
      </div>

            <div className="transparency-notice">
        <div className="transparency-badge">公開透明</div>

        <div>
          <h3>平台公開透明機制</h3>

          <p>
            <strong>地政媒合通不經手交易、不抽取服務佣金。</strong>
          </p>

          <p>
            為保護雙方安全，留言與案件內容禁止交換電話、Line
            或其他聯繫方式，以免遭不法業者或詐騙集團利用。
          </p>

          <p>
            真實聯繫方式不會出現在公開案件中；目前僅在平台核准媒合後，
            雙方才能進入私聊討論需求。
          </p>
        </div>
      </div>
      
    </section>
  );
}

export default HomeHero;