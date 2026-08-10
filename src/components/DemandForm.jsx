import { useState } from "react";
import { supabase } from "../lib/supabase";

function DemandForm() {
  const [formData, setFormData] = useState({
    client_name: "",
    category: "",
    city: "",
    description: "",
  });

  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      !formData.client_name ||
      !formData.category ||
      !formData.city ||
      !formData.description
    ) {
      setMessage("請先完整填寫所有欄位。");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("請先登入，再發布您的需求。");
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase
      .from("cases")
      .insert([
        {
          client_id: user.id,
          client_name: formData.client_name,
          category: formData.category,
          city: formData.city,
          description: formData.description,
        },
      ]);

    setIsSubmitting(false);

    if (error) {
      console.error("發布需求失敗：", error);
      setMessage("發布失敗，請稍後再試。");
      return;
    }

    setMessage("需求已成功發布！地政士將會主動協助您。");

    setFormData({
      client_name: "",
      category: "",
      city: "",
      description: "",
    });
  }

  return (
    <section className="demand-form">
      <h2>📝 免費發布您的房地需求</h2>

      <p>讓專業地政士主動協助您</p>

      <form onSubmit={handleSubmit}>
        <input
          name="client_name"
          value={formData.client_name}
          onChange={handleChange}
          placeholder="您的姓名（媒合前不會公開）"
        />

        <input
          name="category"
          value={formData.category}
          onChange={handleChange}
          placeholder="您的需求，例如：房屋繼承"
        />

        <input
          name="city"
          value={formData.city}
          onChange={handleChange}
          placeholder="所在縣市"
        />

        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="請描述您的問題"
        />

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "發布中..." : "發布需求"}
        </button>
      </form>

      {message && <p>{message}</p>}
    </section>
  );
}

export default DemandForm;