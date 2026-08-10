import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function AgentApplicationForm() {
  const [formData, setFormData] = useState({
    office_name: "",
    license_number: "",
    city: "",
    specialty: "",
  });

  const [application, setApplication] = useState(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getMyApplication();
  }, []);

  async function getMyApplication() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const { data, error } = await supabase
      .from("agent_applications")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("讀取地政士申請失敗：", error);
      return;
    }

    setApplication(data);
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

    if (
      !formData.office_name ||
      !formData.license_number ||
      !formData.city
    ) {
      setMessage("請完整填寫事務所名稱、證書字號與執業縣市。");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("請先登入後再申請。");
      return;
    }

    setIsSubmitting(true);

    const { data, error } = await supabase
      .from("agent_applications")
      .insert([
        {
          user_id: user.id,
          office_name: formData.office_name,
          license_number: formData.license_number,
          city: formData.city,
          specialty: formData.specialty,
        },
      ])
      .select("*")
      .single();

    setIsSubmitting(false);

    if (error) {
      console.error("送出地政士申請失敗：", error);

      if (error.code === "23505") {
        setMessage("您已送出過地政士申請，請等待平台審核。");
        return;
      }

      setMessage("申請送出失敗，請稍後再試。");
      return;
    }

    setApplication(data);
    setMessage("地政士申請已送出，等待平台審核。");
  }

  function getStatusText(status) {
    if (status === "approved") {
      return "✅ 已核准，重新登入後可使用地政士後台。";
    }

    if (status === "rejected") {
      return "❌ 申請未通過，請聯絡平台。";
    }

    return "⏳ 申請審核中。";
  }

  if (application) {
    return (
      <section className="demand-form">
        <h2>
          👨‍💼 地政士身份申請
        </h2>

        <p>
          事務所：{application.office_name}
        </p>

        <p>
          目前狀態：{getStatusText(application.status)}
        </p>
      </section>
    );
  }

  return (
    <section className="demand-form">
      <h2>
        👨‍💼 申請成為地政士
      </h2>

      <p>
        填寫資料後，由平台審核您的地政士身份。
      </p>

      <form onSubmit={handleSubmit}>
        <input
          name="office_name"
          value={formData.office_name}
          onChange={handleChange}
          placeholder="地政士事務所名稱"
        />

        <input
          name="license_number"
          value={formData.license_number}
          onChange={handleChange}
          placeholder="地政士證書字號"
        />

        <input
          name="city"
          value={formData.city}
          onChange={handleChange}
          placeholder="執業縣市"
        />

        <textarea
          name="specialty"
          value={formData.specialty}
          onChange={handleChange}
          placeholder="專長，例如：買賣、繼承、贈與"
        />

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "送出中..." : "送出地政士申請"}
        </button>
      </form>

      {message && <p>{message}</p>}
    </section>
  );
}

export default AgentApplicationForm;