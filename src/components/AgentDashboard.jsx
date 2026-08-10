import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function AgentDashboard() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [applyingCaseId, setApplyingCaseId] = useState(null);
  const [agentId, setAgentId] = useState(null);
  const [agentName, setAgentName] = useState("");
  const [matchRequests, setMatchRequests] = useState({});
  const [unlockedNames, setUnlockedNames] = useState({});

  useEffect(() => {
    getCases();
    getCurrentAgent();
  }, []);

  async function getCases() {
    const { data, error } = await supabase
      .from("case_listings")
      .select("*")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      console.error("讀取案件失敗：", error);
      setErrorMessage("目前無法讀取案件，請稍後再試。");
      return;
    }

    setCases(data);
  }

  async function getCurrentAgent() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setRequestMessage("請先登入地政士帳號。");
      return;
    }

    setAgentId(user.id);

    const { data, error } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("讀取地政士資料失敗：", error);
      setRequestMessage("無法讀取地政士帳號資料。");
      return;
    }

    setAgentName(data.name);
    getMyMatchRequests(user.id);
  }

  async function getMyMatchRequests(currentAgentId) {
    const { data, error } = await supabase
      .from("match_requests")
      .select("id, case_id, status")
      .eq("agent_id", currentAgentId);

    if (error) {
      console.error("讀取媒合狀態失敗：", error);
      return;
    }

    const requestMap = {};

    data.forEach((request) => {
      requestMap[request.case_id] = request;
    });

    setMatchRequests(requestMap);
    getUnlockedNames(data);
  }

  async function getUnlockedNames(requests) {
    const approvedRequests = requests.filter(
      (request) => request.status === "approved"
    );

    const results = await Promise.all(
      approvedRequests.map(async (request) => {
        const { data, error } = await supabase.rpc(
          "get_matched_client_name",
          {
            p_request_id: request.id,
          }
        );

        return {
          requestId: request.id,
          data,
          error,
        };
      })
    );

    const nameMap = {};

    results.forEach((result) => {
      if (result.error) {
        console.error("讀取完整姓名失敗：", result.error);
        return;
      }

      if (result.data && result.data.length > 0) {
        nameMap[result.requestId] = result.data[0].client_name;
      }
    });

    setUnlockedNames(nameMap);
  }

  async function applyForMatch(caseId) {
    setRequestMessage("");

    if (!agentId || !agentName) {
      setRequestMessage("地政士帳號資料讀取中，請稍後再試。");
      return;
    }

    setApplyingCaseId(caseId);

    const { data, error } = await supabase
      .from("match_requests")
      .insert([
        {
          case_id: caseId,
          agent_id: agentId,
          agent_name: agentName,
        },
      ])
      .select("id, case_id, status")
      .single();

    setApplyingCaseId(null);

    if (error) {
      console.error("申請媒合失敗：", error);

      if (error.code === "23505") {
        setRequestMessage("您已申請過這筆案件，請等待平台審核。");
        getMyMatchRequests(agentId);
        return;
      }

      setRequestMessage("申請媒合失敗，請稍後再試。");
      return;
    }

    setMatchRequests({
      ...matchRequests,
      [data.case_id]: data,
    });

    setRequestMessage("已送出媒合申請，等待平台審核。");
  }

  function getButtonText(matchRequest, isApplying) {
    if (isApplying) {
      return "申請送出中...";
    }

    if (!matchRequest) {
      return "🤝 申請媒合";
    }

    if (matchRequest.status === "approved") {
      return "✅ 已媒合成功";
    }

    if (matchRequest.status === "rejected") {
      return "❌ 申請未通過";
    }

    return "⏳ 媒合審核中";
  }

  return (
    <section className="dashboard">
      <div className="dashboard-header">
        <h2>
          👨‍💼 TEST DASHBOARD
        </h2>

        <span>
          免費試用中 剩餘82天
        </span>
      </div>

      <div className="dashboard-card">
        <h3>
          📢 最新案件通知
        </h3>

        {requestMessage && <p>{requestMessage}</p>}

        {loading && <p>案件讀取中...</p>}

        {errorMessage && <p>{errorMessage}</p>}

        {!loading && !errorMessage && cases.length === 0 && (
          <p>目前尚無新案件。</p>
        )}

        {cases.map((caseItem) => {
          const matchRequest = matchRequests[caseItem.id];
          const isApplying = applyingCaseId === caseItem.id;
          const isMatched = matchRequest?.status === "approved";

          return (
            <div className="case" key={caseItem.id}>
              <h4>
                🏠 {caseItem.category}
              </h4>

              <p>
                👤 客戶：{caseItem.masked_client_name}
              </p>

              {isMatched && (
                <p>
                  🔓 媒合成功客戶姓名：
                  {unlockedNames[matchRequest.id] || "讀取中..."}
                </p>
              )}

              <p>
                📍 {caseItem.city}
              </p>

              <p>
                客戶需求：{caseItem.description}
              </p>

              <button
                onClick={() => applyForMatch(caseItem.id)}
                disabled={isApplying || Boolean(matchRequest)}
              >
                {getButtonText(matchRequest, isApplying)}
              </button>
            </div>
          );
        })}
      </div>

      <div className="dashboard-card">
        <h3>
          ⭐ 我的平台數據
        </h3>

        <p>
          👀 本月瀏覽：326次
        </p>

        <p>
          ⭐ 客戶評價：4.9分
        </p>

        <p>
          📌 完成案件：128件
        </p>

        <button>
          💰 購買點數
        </button>

        <button>
          🚀 置頂曝光
        </button>
      </div>
    </section>
  );
}

export default AgentDashboard;