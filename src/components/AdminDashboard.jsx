import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function AdminDashboard() {
  const [requests, setRequests] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [updatingMatchId, setUpdatingMatchId] = useState(null);
  const [updatingApplicationId, setUpdatingApplicationId] = useState(null);

  useEffect(() => {
    getMatchRequests();
    getAgentApplications();
  }, []);

  async function getMatchRequests() {
    const [requestResult, caseResult] = await Promise.all([
      supabase
        .from("match_requests")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("case_listings")
        .select("*"),
    ]);

    setLoading(false);

    if (requestResult.error) {
      console.error("讀取媒合申請失敗：", requestResult.error);
      setMessage("目前無法讀取媒合申請。");
      return;
    }

    if (caseResult.error) {
      console.error("讀取案件資料失敗：", caseResult.error);
      setMessage("目前無法讀取案件資料。");
      return;
    }

    const caseMap = {};

    caseResult.data.forEach((caseItem) => {
      caseMap[caseItem.id] = caseItem;
    });

    setRequests(
      requestResult.data.map((request) => ({
        ...request,
        caseInfo: caseMap[request.case_id],
      }))
    );
  }

  async function getAgentApplications() {
    const { data, error } = await supabase
      .from("agent_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("讀取地政士申請失敗：", error);
      setMessage("目前無法讀取地政士申請。");
      return;
    }

    setApplications(data);
  }

  async function updateRequestStatus(requestId, status) {
    setMessage("");
    setUpdatingMatchId(requestId);

    const functionName =
  status === "approved"
    ? "approve_paid_match_request"
    : "reject_paid_match_request";

const { error } = await supabase.rpc(functionName, {
  p_request_id: requestId,
});

    setUpdatingMatchId(null);

    if (error) {
      console.error("更新媒合狀態失敗：", error);
      setMessage("更新失敗，請稍後再試。");
      return;
    }

    setRequests(
      requests.map((request) =>
        request.id === requestId
          ? { ...request, status }
          : request
      )
    );

    setMessage(
      status === "approved"
        ? "已核准媒合申請。"
        : "已拒絕媒合申請。"
    );
  }

  async function updateAgentApplication(applicationId, action) {
    setMessage("");
    setUpdatingApplicationId(applicationId);

    const functionName =
      action === "approved"
        ? "approve_agent_application"
        : "reject_agent_application";

    const { error } = await supabase.rpc(functionName, {
      p_application_id: applicationId,
    });

    setUpdatingApplicationId(null);

    if (error) {
  console.error("審核地政士申請失敗：", error);
  setMessage(`審核失敗：${error.message}`);
  return;
}

    setApplications(
      applications.map((application) =>
        application.id === applicationId
          ? { ...application, status: action }
          : application
      )
    );

    setMessage(
      action === "approved"
        ? "已核准地政士身份，該帳號重新登入後即可使用地政士後台。"
        : "已拒絕地政士申請。"
    );
  }

  function getStatusText(status) {
    if (status === "approved") {
      return "✅ 已核准";
    }

    if (status === "rejected") {
      return "❌ 已拒絕";
    }

    return "⏳ 待審核";
  }

  return (
    <section className="dashboard">
      <div className="dashboard-header">
        <h2>
          🛠️ 平台管理者後台
        </h2>

        <span>
          管理者
        </span>
      </div>

      {message && <p>{message}</p>}

      <div className="dashboard-card">
        <h3>
          🤝 媒合申請審核
        </h3>

        {loading && <p>媒合申請讀取中...</p>}

        {!loading && requests.length === 0 && (
          <p>目前沒有媒合申請。</p>
        )}

        {requests.map((request) => (
          <div className="case" key={request.id}>
            <h4>
              🏠 {request.caseInfo?.category || `案件 #${request.case_id}`}
            </h4>

            <p>
              👤 客戶：{request.caseInfo?.masked_client_name || "資料讀取中"}
            </p>

            <p>
              📍 地區：{request.caseInfo?.city || "未設定"}
            </p>

            <p>
              📋 需求：{request.caseInfo?.description || "未提供"}
            </p>

            <p>
              👨‍💼 申請地政士：{request.agent_name}
            </p>

            <p>
              目前狀態：{getStatusText(request.status)}
            </p>

            {request.status === "pending" && (
              <>
                <button
                  type="button"
                  onClick={() => updateRequestStatus(request.id, "approved")}
                  disabled={updatingMatchId === request.id}
                >
                  {updatingMatchId === request.id
                    ? "處理中..."
                    : "✅ 核准媒合"}
                </button>

                <button
                  type="button"
                  onClick={() => updateRequestStatus(request.id, "rejected")}
                  disabled={updatingMatchId === request.id}
                >
                  {updatingMatchId === request.id
                    ? "處理中..."
                    : "❌ 拒絕"}
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="dashboard-card">
        <h3>
          👨‍💼 地政士身份審核
        </h3>

        {applications.length === 0 && (
          <p>目前沒有地政士申請。</p>
        )}

        {applications.map((application) => (
          <div className="case" key={application.id}>
            <h4>
              🏢 {application.office_name}
            </h4>

            <p>
              📜 證書字號：{application.license_number}
            </p>

            <p>
              📍 執業縣市：{application.city}
            </p>

            <p>
              ⭐ 專長：{application.specialty || "未填寫"}
            </p>

            <p>
              目前狀態：{getStatusText(application.status)}
            </p>

            {application.status === "pending" && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    updateAgentApplication(application.id, "approved")
                  }
                  disabled={updatingApplicationId === application.id}
                >
                  {updatingApplicationId === application.id
                    ? "處理中..."
                    : "✅ 核准地政士"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateAgentApplication(application.id, "rejected")
                  }
                  disabled={updatingApplicationId === application.id}
                >
                  {updatingApplicationId === application.id
                    ? "處理中..."
                    : "❌ 拒絕"}
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default AdminDashboard;