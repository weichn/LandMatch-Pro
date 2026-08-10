import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function TopUpReview() {
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    getTopUpRequests();
  }, []);

  async function getTopUpRequests() {
    const { data, error } = await supabase
      .from("top_up_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("讀取儲值申請失敗：", error);
      setMessage("目前無法讀取儲值申請。");
      return;
    }

    setRequests(data);
  }

  async function reviewRequest(requestId, action) {
    setMessage("");
    setUpdatingId(requestId);

    const functionName =
      action === "approved"
        ? "approve_top_up_request"
        : "reject_top_up_request";

    const { error } = await supabase.rpc(functionName, {
      p_request_id: requestId,
    });

    setUpdatingId(null);

    if (error) {
      console.error("審核儲值申請失敗：", error);
      setMessage(`審核失敗：${error.message}`);
      return;
    }

    setRequests(
      requests.map((request) =>
        request.id === requestId
          ? { ...request, status: action }
          : request
      )
    );

    setMessage(
      action === "approved"
        ? "已核准儲值，點數已自動加入。"
        : "已拒絕儲值申請。"
    );
  }

  function getPlanText(planCode) {
    if (planCode === "points_10") {
      return "10 點方案";
    }

    if (planCode === "points_30") {
      return "30 點方案";
    }

    return "VIP 月費方案";
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
          💰 儲值申請審核
        </h2>

        <span>
          管理者
        </span>
      </div>

      {message && <p>{message}</p>}

      <div className="dashboard-card">
        {requests.length === 0 && (
          <p>目前沒有儲值申請。</p>
        )}

        {requests.map((request) => (
          <div className="case" key={request.id}>
            <h4>
              {getPlanText(request.plan_code)}
            </h4>

            <p>
              匯款金額：NT${request.amount}
            </p>

            <p>
              匯款帳號末 5 碼：{request.account_last5}
            </p>

            <p>
              匯款時間：
              {new Date(request.transfer_time).toLocaleString("zh-TW")}
            </p>

            <p>
              狀態：{getStatusText(request.status)}
            </p>

            {request.status === "pending" && (
              <>
                <button
                  type="button"
                  onClick={() => reviewRequest(request.id, "approved")}
                  disabled={updatingId === request.id}
                >
                  {updatingId === request.id
                    ? "處理中..."
                    : "✅ 確認匯款並加點"}
                </button>

                <button
                  type="button"
                  onClick={() => reviewRequest(request.id, "rejected")}
                  disabled={updatingId === request.id}
                >
                  {updatingId === request.id
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

export default TopUpReview;