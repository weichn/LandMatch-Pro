import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function AgentCard() {
  const [agents, setAgents] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    getAgents();
  }, []);

  async function getAgents() {
    const { data, error } = await supabase
      .from("agent_listings")
      .select("*")
      .order("rating", { ascending: false });

    if (error) {
      console.error("讀取地政士失敗：", error);
      setErrorMessage("目前無法讀取推薦地政士。");
      return;
    }

    setAgents(data);
  }

  function goToDemandForm() {
    document.getElementById("demand-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <section>
      <h2>
        ⭐ 推薦地政士
      </h2>

      <p>
        為保障雙方隱私，聯絡方式將於媒合成功後提供。
      </p>

      {errorMessage && <p>{errorMessage}</p>}

      {!errorMessage && agents.length === 0 && (
        <p>目前尚無地政士資料。</p>
      )}

      <div className="agent-list">
        {agents.map((agent) => (
          <div className="agent-card" key={agent.id}>
            <h3>
              👨‍💼 {agent.display_name}
            </h3>

            <p>
              📍 {agent.city || "未設定地區"}
            </p>

            <p className="star">
              ⭐⭐⭐⭐⭐
              <span>
                {Number(agent.rating || 5).toFixed(1)} 分
              </span>
            </p>

            <p>
              專長：{agent.specialty || "一般房地服務"}
            </p>

            <p>
              完成案件：{agent.completed_cases || 0} 件
            </p>

            <button onClick={goToDemandForm}>
              🤝 透過平台媒合
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default AgentCard;