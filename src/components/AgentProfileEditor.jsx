import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function AgentProfileEditor() {
  const [agentId, setAgentId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    firm_name: "",
    firm_address: "",
    guild_name: "",
    bio: "",
    city: "",
    specialty: "",
    avatar: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getMyAgentProfile();
  }, []);

  async function getMyAgentProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("請先登入地政士帳號。");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("agents")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle();

    setLoading(false);

    if (error) {
      console.error("讀取地政士資料失敗：", error);
      setMessage("無法讀取您的地政士資料。");
      return;
    }

    if (!data) {
      setMessage("尚未建立您的地政士公開資料。");
      return;
    }

    setAgentId(data.id);

    setFormData({
      name: data.name || "",
      firm_name: data.firm_name || "",
      firm_address: data.firm_address || "",
      guild_name: data.guild_name || "",
      bio: data.bio || "",
      city: data.city || "",
      specialty: data.specialty || "",
      avatar: data.avatar || "",
    });
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData({
      ...formData,
      [name]: value,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (!formData.name || !formData.firm_name || !formData.city) {
      setMessage("請至少填寫姓名、事務所名稱與執業縣市。");
      return;
    }

    setIsSaving(true);

    const { error } = await supabase
      .from("agents")
      .update(formData)
      .eq("id", agentId);

    setIsSaving(false);

    if (error) {
      console.error("更新地政士資料失敗：", error);
      setMessage("儲存失敗，請稍後再試。");
      return;
    }

    setMessage("地政士資料已更新，首頁推薦卡片也會同步更新。");
  }

  if (loading) {
    return <p>地政士資料讀取中...</p>;
  }

  return (
    <section className="demand-form">
      <h2>
        ✏️ 編輯我的地政士資料
      </h2>

      <form onSubmit={handleSubmit}>
        <input
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="地政士姓名"
        />

        <input
          name="firm_name"
          value={formData.firm_name}
          onChange={handleChange}
          placeholder="事務所名稱"
        />

        <input
          name="city"
          value={formData.city}
          onChange={handleChange}
          placeholder="執業縣市"
        />

        <input
          name="firm_address"
          value={formData.firm_address}
          onChange={handleChange}
          placeholder="事務所地址（選填）"
        />

        <input
          name="guild_name"
          value={formData.guild_name}
          onChange={handleChange}
          placeholder="所屬公會（選填）"
        />

        <input
          name="specialty"
          value={formData.specialty}
          onChange={handleChange}
          placeholder="專長，例如：買賣、繼承、贈與"
        />

        <input
          name="avatar"
          type="url"
          value={formData.avatar}
          onChange={handleChange}
          placeholder="頭像圖片網址（選填）"
        />

        <textarea
          name="bio"
          value={formData.bio}
          onChange={handleChange}
          placeholder="自我介紹"
        />

        <button type="submit" disabled={isSaving || !agentId}>
          {isSaving ? "儲存中..." : "儲存地政士資料"}
        </button>
      </form>

      {message && <p>{message}</p>}
    </section>
  );
}

export default AgentProfileEditor;