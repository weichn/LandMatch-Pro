import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function PaidMatchDashboard() {
  const [cases, setCases] = useState([]);
  const [points, setPoints] = useState(0);
  const [requests, setRequests] = useState({});
  const [unlockedNames, setUnlockedNames] = useState({});
  const [activeCaseId, setActiveCaseId] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("請先登入地政士帳號。");
      setLoading(false);
      return;
    }

    const [profileResult, caseResult, requestResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("points")
        .eq("id", user.id)
        .single(),
      supabase
        .from("case_listings")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("match_requests")
        .select("id, case_id, status, point_status")
        .eq("agent_id", user.id),
    ]);

    setLoading(false);

    if (profileResult.error || caseResult.error || requestResult.error) {
      console.error(
        "讀取付費媒合後台失敗：",
        profileResult.error || caseResult.error || requestResult.error
      );
      setMessage("目前無法讀取媒合資料，請稍後再試。");
      return;
    }

    setPoints(profileResult.data.points || 0);
    setCases(caseResult.data);

    const requestMap = {};

    requestResult.data.forEach((request) => {
      requestMap[request.case_id] = request;
    });

    setRequests(requestMap);
    loadUnlockedNames(requestResult.data);
  }

  async function loadUnlockedNames(matchRequests) {
    const approvedRequests = matchRequests.filter(
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
      if (!result.error && result.data?.length > 0) {
        nameMap[result.requestId] = result.data[0].client_name;
      }
    });

    setUnlockedNames(nameMap);
  }

  function openComposer(caseId) {
    setMessage("");
    setActiveCaseId(caseId);
    setMessageText("");
  }

  function closeComposer() {
    setActiveCaseId(null);
    setMessageText("");
  }

  async function sendMatchRequest(caseId) {
    setMessage("");

    if (!messageText.trim()) {
      setMessage("請先填寫給民眾的媒合訊息。");
      return;
    }

    setIsSubmitting(true);

    const { data, error } = await supabase.rpc(
      "create_paid_match_request",
      {
        p_case_id: caseId,
        p_initial_message: messageText.trim(),
      }
    );

    setIsSubmitting(false);

    if (error) {
      console.error("發起媒合失敗：", error);
      setMessage(`發起媒合失敗：${error.message}`);
      return;
    }

    setRequests({
      ...requests,
      [caseId]: {
        id: data,
        case_id: caseId,
        status: "pending",
        point_status: "held",
      },
    });

    setPoints(Math.max(0, points - 10));
    setMessage("媒合邀請已送出，暫扣 10 點，等待平台審核。");
    closeComposer();
  }

  function getStatusText(request) {
    if (request.status === "approved") {
      return "✅ 媒合成功";
    }

    if (request.status === "rejected") {
      return "❌ 未通過，點數已退回";
    }

    return "⏳ 媒合審核中";
  }

  return (
    <section className="dashboard">
      <div className="dashboard-header">
        <h2>
          🤝 付費媒合案件
        </h2>

        <span>
          剩餘點數：{points} 點
        </span>
      </div>

      <div className="dashboard-card">
        <p>
          發起媒合將暫扣 10 點；管理者未核准時，點數會自動退回。
        </p>

        {message && <p>{message}</p>}

        {loading && <p>案件讀取中...</p>}

        {!loading && cases.length === 0 && (
          <p>目前尚無案件。</p>
        )}

        {cases.map((caseItem) => {
          const request = requests[caseItem.id];
          const isComposerOpen = activeCaseId === caseItem.id;

          return (
            <div className="case" key={caseItem.id}>
              <h4>
                🏠 {caseItem.category}
              </h4>

              <p>
                👤 客戶：{caseItem.masked_client_name}
              </p>

              <p>
                📍 {caseItem.city}
              </p>

              <p>
                客戶需求：{caseItem.description}
              </p>

              {request?.status === "approved" && (
                <p>
                  🔓 媒合成功客戶姓名：
                  {unlockedNames[request.id] || "讀取中..."}
                </p>
              )}

              {!request && !isComposerOpen && (
                <button onClick={() => openComposer(caseItem.id)}>
                  ✉️ 發起媒合（10 點）
                </button>
              )}

              {!request && isComposerOpen && (
                <>
                  <textarea
                    value={messageText}
                    onChange={(event) =>
                      setMessageText(event.target.value)
                    }
                    placeholder="請簡短介紹您能如何協助這位民眾"
                  />

                  <button
                    onClick={() => sendMatchRequest(caseItem.id)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? "送出中..."
                      : "送出媒合邀請並暫扣 10 點"}
                  </button>

                  <button
                    type="button"
                    onClick={closeComposer}
                    disabled={isSubmitting}
                  >
                    取消
                  </button>
                </>
              )}

              {request && (
                <button disabled>
                  {getStatusText(request)}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default PaidMatchDashboard;