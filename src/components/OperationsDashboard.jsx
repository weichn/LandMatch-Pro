import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function OperationsDashboard() {
  const [todayStats, setTodayStats] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadOperationsData();
  }, []);

  async function loadOperationsData() {
    setLoading(true);
    setErrorMessage("");

    const [todayResult, monthlyResult, messagesResult] = await Promise.all([
      supabase.rpc("get_admin_operation_stats"),
      supabase.rpc("get_admin_monthly_operation_stats"),
      supabase.rpc("get_admin_chat_messages", {
        p_limit: 500,
      }),
    ]);

    setLoading(false);

    if (todayResult.error) {
      console.error("讀取今日營運統計失敗：", todayResult.error);
      setErrorMessage("目前無法讀取今日營運統計資料。");
      return;
    }

    if (monthlyResult.error) {
      console.error("讀取每月營運統計失敗：", monthlyResult.error);
      setErrorMessage("目前無法讀取每月營運統計資料。");
      return;
    }

    if (messagesResult.error) {
      console.error("讀取訊息紀錄失敗：", messagesResult.error);
      setErrorMessage("目前無法讀取訊息紀錄。");
      return;
    }

    setTodayStats(todayResult.data?.[0] || null);
    setMonthlyStats(monthlyResult.data?.[0] || null);
    setMessages(messagesResult.data || []);
  }

  function formatMoney(amount) {
    return `NT$ ${Number(amount || 0).toLocaleString("zh-TW")}`;
  }

  function formatDate(dateText) {
    if (!dateText) {
      return "未提供時間";
    }

    return new Date(dateText).toLocaleString("zh-TW", {
      hour12: false,
    });
  }

  function getRoleText(role) {
    if (role === "client") {
      return "民眾";
    }

    if (role === "agent") {
      return "地政士";
    }

    if (role === "admin") {
      return "管理者";
    }

    return "未知身份";
  }

  function renderTodayStats() {
    return (
      <div className="operation-stat-grid">
        <div className="operation-stat">
          <span>👀 今日瀏覽</span>
          <strong>{todayStats.today_views}</strong>
          <small>瀏覽分頁數</small>
        </div>

        <div className="operation-stat">
          <span>📝 今日發文</span>
          <strong>{todayStats.today_cases}</strong>
          <small>新發布案件</small>
        </div>

        <div className="operation-stat">
          <span>💳 今日交易</span>
          <strong>{todayStats.today_top_up_count}</strong>
          <small>已核准儲值訂單</small>
        </div>

        <div className="operation-stat">
          <span>💰 今日交易金額</span>
          <strong>{formatMoney(todayStats.today_top_up_amount)}</strong>
          <small>已核准儲值金額</small>
        </div>

        <div className="operation-stat">
          <span>🤝 今日核准媒合</span>
          <strong>{todayStats.today_approved_matches}</strong>
          <small>成功媒合案件</small>
        </div>

        <div className="operation-stat">
          <span>💬 全站訊息</span>
          <strong>{todayStats.total_messages}</strong>
          <small>目前累積私聊訊息</small>
        </div>
      </div>
    );
  }

  function renderMonthlyStats() {
    return (
      <div className="operation-stat-grid">
        <div className="operation-stat monthly-stat">
          <span>👀 本月瀏覽</span>
          <strong>{monthlyStats.month_views}</strong>
          <small>本月瀏覽分頁數</small>
        </div>

        <div className="operation-stat monthly-stat">
          <span>📝 本月發文</span>
          <strong>{monthlyStats.month_cases}</strong>
          <small>本月新發布案件</small>
        </div>

        <div className="operation-stat monthly-stat">
          <span>💳 本月交易</span>
          <strong>{monthlyStats.month_top_up_count}</strong>
          <small>本月已核准儲值訂單</small>
        </div>

        <div className="operation-stat monthly-stat">
          <span>💰 本月交易金額</span>
          <strong>{formatMoney(monthlyStats.month_top_up_amount)}</strong>
          <small>本月已核准儲值金額</small>
        </div>

        <div className="operation-stat monthly-stat">
          <span>🤝 本月核准媒合</span>
          <strong>{monthlyStats.month_approved_matches}</strong>
          <small>本月成功媒合案件</small>
        </div>

        <div className="operation-stat monthly-stat">
          <span>💬 本月訊息</span>
          <strong>{monthlyStats.month_messages}</strong>
          <small>本月新增私聊訊息</small>
        </div>
      </div>
    );
  }

  return (
    <section className="operations-dashboard">
      <div className="dashboard-header">
        <div>
          <p className="pool-eyebrow">營運管理</p>
          <h2>📊 平台營運總覽</h2>
        </div>

        <button type="button" onClick={loadOperationsData}>
          重新整理資料
        </button>
      </div>

      {loading && <p>營運資料讀取中...</p>}

      {errorMessage && <p>{errorMessage}</p>}

      {!loading && !errorMessage && todayStats && monthlyStats && (
        <>
          <div className="operation-overview-title">
            <h3>☀️ 今日平台總覽</h3>
            <p>即時掌握今天的網站與媒合狀況。</p>
          </div>

          {renderTodayStats()}

          <div className="operation-overview-title monthly-overview-title">
            <h3>📅 本月平台總覽</h3>
            <p>統計本月累積的營運表現。</p>
          </div>

          {renderMonthlyStats()}

          <div className="dashboard-card operation-message-list">
            <h3>💬 民眾與地政士訊息紀錄</h3>

            <p>顯示最近 {messages.length} 則訊息，僅限管理者查看。</p>

            {messages.length === 0 && <p>目前尚無私聊訊息。</p>}

            {messages.map((chatMessage) => (
              <article className="operation-message" key={chatMessage.reply_id}>
                <div>
                  <strong>
                    {chatMessage.author_name}・
                    {getRoleText(chatMessage.author_role)}
                  </strong>

                  <span>{formatDate(chatMessage.created_at)}</span>
                </div>

                <p>
                  案件：{chatMessage.category || "未分類"}・
                  {chatMessage.city || "未設定地區"}
                </p>

                <blockquote>{chatMessage.content}</blockquote>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default OperationsDashboard;