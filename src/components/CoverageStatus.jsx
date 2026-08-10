import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const cities = [
  "基隆市",
  "臺北市",
  "新北市",
  "桃園市",
  "新竹市",
  "新竹縣",
  "苗栗縣",
  "臺中市",
  "彰化縣",
  "南投縣",
  "雲林縣",
  "嘉義市",
  "嘉義縣",
  "臺南市",
  "高雄市",
  "屏東縣",
  "宜蘭縣",
  "花蓮縣",
  "臺東縣",
  "澎湖縣",
  "金門縣",
  "連江縣",
];

function normalizeCity(city) {
  return (city || "")
    .replace("臺", "台")
    .replace("市", "")
    .replace("縣", "");
}

function CoverageStatus() {
  const [agentCounts, setAgentCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCoverageStatus();
  }, []);

  async function getCoverageStatus() {
    const { data, error } = await supabase
      .from("agent_listings")
      .select("city");

    setLoading(false);

    if (error) {
      console.error("讀取全台媒合狀態失敗：", error);
      return;
    }

    const nextCounts = {};

    data.forEach((agent) => {
      const cityKey = normalizeCity(agent.city);

      if (cityKey) {
        nextCounts[cityKey] = (nextCounts[cityKey] || 0) + 1;
      }
    });

    setAgentCounts(nextCounts);
  }

  return (
    <section className="coverage-status">
      <p className="pool-eyebrow">全台服務範圍</p>

      <h2>全台縣市媒合狀態</h2>

      <p className="coverage-description">
        民眾可於全台免費發布需求；已有在地地政士的縣市可優先媒合，
        其餘縣市持續招募專業地政士加入。
      </p>

      {loading && <p>媒合狀態讀取中...</p>}

      {!loading && (
        <div className="coverage-grid">
          {cities.map((city) => {
            const count = agentCounts[normalizeCity(city)] || 0;
            const hasAgents = count > 0;

            return (
              <div
                className={`coverage-city ${hasAgents ? "is-active" : "is-recruiting"}`}
                key={city}
              >
                <strong>📍 {city}</strong>

                <span>
                  {hasAgents
                    ? `✅ 已有 ${count} 位地政士`
                    : "📢 招募在地地政士中"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="coverage-note">
        即使所在縣市尚在招募中，也可先發布需求；平台會依案件需求優先招募合適的在地地政士。
      </p>
    </section>
  );
}

export default CoverageStatus;