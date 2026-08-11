import { useState } from "react";
import { supabase } from "../lib/supabase";

function AuthBox({ initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
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

    if (!formData.email || !formData.password) {
      setMessage("請輸入 Email 與密碼。");
      return;
    }

    if (mode === "signup" && (!formData.name || !formData.phone)) {
      setMessage("請完整填寫姓名與電話。");
      return;
    }

    setIsSubmitting(true);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            phone: formData.phone,
          },
        },
      });

      setIsSubmitting(false);

      if (error) {
        console.error("註冊失敗：", error);
        setMessage(error.message);
        return;
      }

      if (data.user && !data.session) {
        setMessage("註冊成功！請到 Email 信箱完成驗證後再登入。");
        return;
      }

      setMessage("註冊成功，您已登入地政媒合通。");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    });

    setIsSubmitting(false);

    if (error) {
      console.error("登入失敗：", error);
      setMessage("登入失敗，請確認 Email 與密碼。");
      return;
    }

    setMessage("登入成功！");
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setMessage("");
  }

  return (
    <section className="auth-box">
      <h2>
        {mode === "login"
          ? "🔐 登入地政媒合通"
          : "📝 註冊地政媒合通"}
      </h2>

      <p>
        民眾可發布需求；地政士註冊後將由平台審核身份。
      </p>

      <div>
        {mode === "login" ? (
          <button
            type="button"
            onClick={() => switchMode("signup")}
          >
            沒有帳號？前往註冊
          </button>
        ) : (
          <button
            type="button"
            onClick={() => switchMode("login")}
          >
            已有帳號？前往登入
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        {mode === "signup" && (
          <>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="您的姓名"
            />

            <input
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="聯絡電話"
            />
          </>
        )}

        <input
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Email"
        />

        <input
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="密碼（至少 6 個字元）"
        />

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "處理中..."
            : mode === "login"
              ? "立即登入"
              : "建立帳號"}
        </button>
      </form>

      {message && <p>{message}</p>}
    </section>
  );
}

export default AuthBox;