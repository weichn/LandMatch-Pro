import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const plans = [
  {
    code: "points_10",
    title: "10 點方案",
    price: 239,
    detail: "可發起 1 次媒合",
  },
  {
    code: "points_30",
    title: "30 點超值方案",
    price: 599,
    detail: "可發起 3 次媒合",
  },
  {
    code: "vip_monthly",
    title: "VIP 月費方案",
    price: 1099,
    detail: "60 點＋一個月 VIP",
  },
];

function PurchasePoints() {
  const [planCode, setPlanCode] = useState("points_10");
  const [accountLast5, setAccountLast5] = useState("");
  const [transferTime, setTransferTime] = useState("");
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTransferTime(new Date().toISOString().slice(0, 16));
    getMyRequests();
  }, []);

  async function getMyRequests() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const { data, error } = await supabase
      .from("top_up_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("讀取儲值紀錄失敗：", error);
      return;
    }

    setRequests(data);
  }

  function getSelectedPlan() {
    return plans.find((plan) => plan.code === planCode);
  }

  function getStatusText(status) {
    if (status === "approved") {
      return "✅ 已核准";
    }

    if (status === "rejected") {
      return "❌ 未核准";
    }

    return "⏳ 等待管理者確認";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (!/^[0-9]{5}$/.test(accountLast5)) {
      setMessage("請輸入匯款帳號末 5 碼。");
      return;
    }

    if (!transferTime) {
      setMessage("請選擇匯款時間。");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("請先登入後再送出儲值申請。");
      return;
    }

    const selectedPlan = getSelectedPlan();

    setIsSubmitting(true);

    const { error } = await supabase
      .from("top_up_requests")
      .insert([
        {
          user_id: user.id,
          plan_code: selectedPlan.code,
          amount: selectedPlan.price,
          account_last5: accountLast5,
          transfer_time: new Date(transferTime).toISOString(),
        },
      ]);

    setIsSubmitting(false);

    if (error) {
      console.error("送出儲值申請失敗：", error);
      setMessage("送出失敗，請稍後再試。");
      return;
    }

    setMessage("儲值申請已送出，等待管理者確認後加點。");
    setAccountLast5("");
    getMyRequests();
  }

  return (
    <section className="demand-form">
      <h2>
        💰 購買媒合點數／VIP
      </h2>

      <p>
        選擇方案後匯款，填寫帳號末 5 碼，由管理者人工確認後加點。
      </p>

      <p>
        🏦 銀行代號：013
        <br />
        帳戶：205506214859
        <br />
        戶名：陳緯宸
      </p>

      <form onSubmit={handleSubmit}>
        <select
          value={planCode}
          onChange={(event) => setPlanCode(event.target.value)}
        >
          {plans.map((plan) => (
            <option key={plan.code} value={plan.code}>
              {plan.title}｜NT${plan.price}｜{plan.detail}
            </option>
          ))}
        </select>

        <input
          value={accountLast5}
          onChange={(event) =>
            setAccountLast5(event.target.value.replace(/\D/g, "").slice(0, 5))
          }
          placeholder="匯款帳號末 5 碼"
          inputMode="numeric"
        />

        <input
          type="datetime-local"
          value={transferTime}
          onChange={(event) => setTransferTime(event.target.value)}
        />

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "送出中..." : "送出儲值申請"}
        </button>
      </form>

      {message && <p>{message}</p>}

      {requests.length > 0 && (
        <div>
          <h3>
            我的儲值申請
          </h3>

          {requests.map((request) => (
            <p key={request.id}>
              NT${request.amount}｜{getStatusText(request.status)}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

export default PurchasePoints;