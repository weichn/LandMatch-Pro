import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function MyChats({ role }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    loadConversations();
  }, [role]);

  useEffect(() => {
    if (!selectedConversation) {
      return;
    }

    const timer = setInterval(async () => {
      await loadMessages(selectedConversation.caseId);
      await markConversationAsRead(selectedConversation.caseId);
    }, 5000);

    return () => {
      clearInterval(timer);
    };
  }, [selectedConversation]);

  async function loadUnreadCounts(conversationItems, currentUserId) {
    const caseIds = conversationItems.map((item) => item.caseId);

    if (caseIds.length === 0) {
      setUnreadCounts({});
      return;
    }

    const { data: readItems, error: readsError } = await supabase
      .from("chat_reads")
      .select("case_id, last_read_at")
      .eq("user_id", currentUserId)
      .in("case_id", caseIds);

    if (readsError) {
      console.error("讀取已讀紀錄失敗：", readsError);
      return;
    }

    const { data: replyItems, error: repliesError } = await supabase
      .from("replies")
      .select("case_id, author_id, created_at")
      .in("case_id", caseIds)
      .neq("author_id", currentUserId);

    if (repliesError) {
      console.error("讀取未讀訊息失敗：", repliesError);
      return;
    }

    const readTimeMap = {};

    readItems.forEach((readItem) => {
      readTimeMap[readItem.case_id] = readItem.last_read_at;
    });

    const nextUnreadCounts = {};

    replyItems.forEach((replyItem) => {
      const lastReadAt = readTimeMap[replyItem.case_id];

      if (
        !lastReadAt ||
        new Date(replyItem.created_at) > new Date(lastReadAt)
      ) {
        nextUnreadCounts[replyItem.case_id] =
          (nextUnreadCounts[replyItem.case_id] || 0) + 1;
      }
    });

    setUnreadCounts(nextUnreadCounts);
  }

  async function loadConversations() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    setUserId(user.id);

    if (role === "client") {
      const { data: ownCases, error: casesError } = await supabase
        .from("cases")
        .select("id, category, city")
        .eq("client_id", user.id);

      if (casesError) {
        console.error("讀取我的案件失敗：", casesError);
        setMessage("目前無法讀取您的案件。");
        setLoading(false);
        return;
      }

      const caseIds = ownCases.map((caseItem) => caseItem.id);

      if (caseIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const { data: requests, error: requestsError } = await supabase
        .from("match_requests")
        .select("id, case_id, agent_name")
        .eq("status", "approved")
        .in("case_id", caseIds);

      if (requestsError) {
        console.error("讀取媒合資料失敗：", requestsError);
        setMessage("目前無法讀取已核准的媒合。");
        setLoading(false);
        return;
      }

      const caseMap = {};

      ownCases.forEach((caseItem) => {
        caseMap[caseItem.id] = caseItem;
      });

      const conversationItems = requests.map((request) => ({
        id: request.id,
        caseId: request.case_id,
        category: caseMap[request.case_id]?.category || "房地案件",
        city: caseMap[request.case_id]?.city || "未設定地區",
        partnerName: request.agent_name || "已核准地政士",
      }));

      setConversations(conversationItems);
      await loadUnreadCounts(conversationItems, user.id);
    }

    if (role === "agent") {
      const { data: requests, error: requestsError } = await supabase
        .from("match_requests")
        .select("id, case_id")
        .eq("agent_id", user.id)
        .eq("status", "approved");

      if (requestsError) {
        console.error("讀取媒合資料失敗：", requestsError);
        setMessage("目前無法讀取已核准的媒合。");
        setLoading(false);
        return;
      }

      const caseIds = requests.map((request) => request.case_id);

      if (caseIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const { data: caseItems, error: casesError } = await supabase
        .from("case_listings")
        .select("id, category, city, masked_client_name")
        .in("id", caseIds);

      if (casesError) {
        console.error("讀取案件資料失敗：", casesError);
        setMessage("目前無法讀取案件資料。");
        setLoading(false);
        return;
      }

      const caseMap = {};

      caseItems.forEach((caseItem) => {
        caseMap[caseItem.id] = caseItem;
      });

      const conversationItems = requests.map((request) => ({
        id: request.id,
        caseId: request.case_id,
        category: caseMap[request.case_id]?.category || "房地案件",
        city: caseMap[request.case_id]?.city || "未設定地區",
        partnerName: caseMap[request.case_id]?.masked_client_name || "客戶",
      }));

      setConversations(conversationItems);
      await loadUnreadCounts(conversationItems, user.id);
    }

    setLoading(false);
  }

  async function loadMessages(caseId) {
    const { data, error } = await supabase
      .from("replies")
      .select("id, author_id, content, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("讀取訊息失敗：", error);
      return;
    }

    setMessages(data);
  }

  async function markConversationAsRead(caseId) {
    if (!userId) {
      return;
    }

    const { error } = await supabase
      .from("chat_reads")
      .upsert(
        {
          case_id: caseId,
          user_id: userId,
          last_read_at: new Date().toISOString(),
        },
        {
          onConflict: "case_id,user_id",
        }
      );

    if (error) {
      console.error("更新已讀狀態失敗：", error);
      return;
    }

    setUnreadCounts((currentCounts) => ({
      ...currentCounts,
      [caseId]: 0,
    }));
  }

  async function openConversation(conversation) {
    setSelectedConversation(conversation);
    setMessages([]);
    setMessage("");

    await loadMessages(conversation.caseId);
    await markConversationAsRead(conversation.caseId);
  }

  async function sendMessage(event) {
    event.preventDefault();
    setMessage("");

    if (!selectedConversation || !newMessage.trim()) {
      return;
    }

    const { error } = await supabase
      .from("replies")
      .insert([
        {
          case_id: selectedConversation.caseId,
          author_id: userId,
          content: newMessage.trim(),
        },
      ]);

    if (error) {
      console.error("傳送訊息失敗：", error);
      setMessage("訊息傳送失敗，請稍後再試。");
      return;
    }

    setNewMessage("");
    await loadMessages(selectedConversation.caseId);
  }

  if (role !== "client" && role !== "agent") {
    return null;
  }

  return (
    <section className="dashboard">
      <div className="dashboard-header">
        <h2>💬 我的私聊</h2>

        <span>每 5 秒自動更新</span>
      </div>

      <div className="dashboard-card">
        <h3>已核准的案件對話</h3>

        {loading && <p>對話讀取中...</p>}

        {message && <p>{message}</p>}

        {!loading && conversations.length === 0 && (
          <p>目前還沒有已核准的媒合對話。</p>
        )}

        {conversations.map((conversation) => {
          const unreadCount = unreadCounts[conversation.caseId] || 0;

          return (
            <div className="case" key={conversation.id}>
              <h4>🏠 {conversation.category}</h4>

              <p>📍 {conversation.city}</p>

              <p>對話對象：{conversation.partnerName}</p>

              {unreadCount > 0 && (
                <p>🔴 未讀訊息：{unreadCount} 則</p>
              )}

              <button
                type="button"
                onClick={() => openConversation(conversation)}
              >
                {unreadCount > 0
                  ? `開啟私聊（未讀 ${unreadCount}）`
                  : "開啟私聊"}
              </button>
            </div>
          );
        })}
      </div>

      {selectedConversation && (
        <div className="dashboard-card">
          <h3>
            💬 {selectedConversation.category}｜{selectedConversation.partnerName}
          </h3>

          {messages.length === 0 && <p>尚未有訊息，先向對方打聲招呼吧。</p>}

          {messages.map((chatMessage) => (
            <div className="case" key={chatMessage.id}>
              <p>
                <strong>
                  {chatMessage.author_id === userId ? "我" : "對方"}：
                </strong>
                {chatMessage.content}
              </p>
            </div>
          ))}

          <form onSubmit={sendMessage}>
            <textarea
              value={newMessage}
              onChange={(event) => setNewMessage(event.target.value)}
              placeholder="輸入訊息..."
            />

            <button type="submit">送出訊息</button>
          </form>
        </div>
      )}
    </section>
  );
}

export default MyChats;