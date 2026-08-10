import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function PublicCasePool() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    getPublicCases();
  }, []);

  async function getPublicCases() {
    const { data, error } = await supabase
      .from("case_listings")
      .select("id, masked_client_name, category, city, description, created_at")
      .order("created_at", { ascending: false })
      .limit(6);

    setLoading(false);

    if (error) {
      console.error("讀取公開案件失敗：", error);
      setErrorMessage("目前無法讀取公開案件，請稍後再試。");
      return;
    }

    setCases(data);
  }

  function scrollToDemandForm() {
    document.querySelector(".demand-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <section className="public-case-pool">
      <p className="pool-eyebrow">公開案件池</p>

      <h2>目前的案件需求</h2>

      <p className="pool-description">
        地政士可查看匿名案件內容並申請媒合；民眾真實聯繫方式不會公開。
      </p>

      {loading && <p>案件讀取中...</p>}

      {errorMessage && <p>{errorMessage}</p>}

      {!loading && !errorMessage && cases.length === 0 && (
        <p>目前尚無公開案件需求。</p>
      )}

      <div className="case-pool-grid">
        {cases.map((caseItem) => (
          <article className="case-pool-card" key={caseItem.id}>
            <div className="case-pool-top">
              <span>公開媒合中</span>
              <span>案件 #{caseItem.id}</span>
            </div>

            <h3>🏠 {caseItem.category}</h3>

            <p>👤 {caseItem.masked_client_name}</p>

            <p>📍 {caseItem.city}</p>

            <p className="case-pool-description">
              {caseItem.description}
            </p>

            <div className="case-pool-footer">
              <span>🔒 聯繫方式將於媒合核准後提供</span>
            </div>
          </article>
        ))}
      </div>

      <button type="button" onClick={scrollToDemandForm}>
        我也要免費發布需求
      </button>
    </section>
  );
}

export default PublicCasePool;