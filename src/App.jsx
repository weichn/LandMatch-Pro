import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import "./App.css";
import Header from "./components/Header";
import AuthBox from "./components/AuthBox";
import SearchBox from "./components/SearchBox";
import AgentCard from "./components/AgentCard";
import DemandForm from "./components/DemandForm";
import PaidMatchDashboard from "./components/PaidMatchDashboard";
import AdminDashboard from "./components/AdminDashboard";
import AgentApplicationForm from "./components/AgentApplicationForm";
import AgentProfileEditor from "./components/AgentProfileEditor";
import PurchasePoints from "./components/PurchasePoints";
import TopUpReview from "./components/TopUpReview";
import MyChats from "./components/MyChats";
import HomeHero from "./components/HomeHero";
import PublicCasePool from "./components/PublicCasePool";
import Footer from "./components/Footer";
import OperationsDashboard from "./components/OperationsDashboard";
import BackToTop from "./components/BackToTop";
import CoverageStatus from "./components/CoverageStatus";

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
const [authMode, setAuthMode] = useState("login");

  useEffect(() => {
    getSession();

        const visitKey = "landmatch_visit_recorded";

    if (!sessionStorage.getItem(visitKey)) {
      sessionStorage.setItem(visitKey, "true");

      supabase.rpc("record_page_visit").then(({ error }) => {
        if (error) {
          console.error("記錄瀏覽失敗：", error);
        }
      });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);

      if (currentSession) {
        getProfile(currentSession.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function getSession() {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    setSession(currentSession);

    if (currentSession) {
      await getProfile(currentSession.user.id);
    } else {
      setLoading(false);
    }
  }

  async function getProfile(userId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("name, role, points")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("讀取帳號資料失敗：", error);
      setLoading(false);
      return;
    }

    setProfile(data);
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  function openAuth(mode) {
  setAuthMode(mode);
  setShowAuth(true);

  setTimeout(() => {
    document.querySelector(".auth-box")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 100);
}

  const canViewAgentDashboard =
    profile?.role === "agent" || profile?.role === "admin";

  return (
    <div>
      <Header
  onOpenAuth={openAuth}
  isLoggedIn={Boolean(session)}
  onLogout={handleLogout}
/>

      <main>
        <HomeHero />

        <PublicCasePool />
        <CoverageStatus />
        {loading && <p>帳號資料讀取中...</p>}

        {!loading && !session && showAuth && (
  <AuthBox key={authMode} initialMode={authMode} />
)}

        {!loading && session && (
          <section className="account-status">
            <h2>
              👋 歡迎回來，{profile?.name || "地政媒合通使用者"}
            </h2>

            <p>
              目前身份：{profile?.role || "client"}
            </p>

            {profile?.role === "agent" && (
  <p>
    💎 可用媒合點數：{profile?.points || 0} 點
  </p>
)}

           <button
  type="button"
  onClick={() => {
    window.location.href = "/delete-account.html";
  }}
>
  申請刪除帳號
</button>

<button
  type="button"
  onClick={handleLogout}
>
  登出
</button>
          </section>
        )}

        {!loading && profile?.role === "admin" && (
  <OperationsDashboard />
)}
        
        {!loading && profile?.role === "admin" && (
          <AdminDashboard />
        )}

        {!loading && profile?.role === "admin" && (
  <TopUpReview />
)}

{!loading && session && profile?.role === "client" && (
  <AgentApplicationForm />
)}

{!loading && session && profile?.role === "agent" && (
  <AgentProfileEditor />
)}

{!loading && session && profile?.role === "agent" && (
  <PurchasePoints />
)}
        <SearchBox />

        <AgentCard />

        <DemandForm />

        {profile?.role === "agent" && <PaidMatchDashboard />}

        {!loading &&
  session &&
  (profile?.role === "client" || profile?.role === "agent") && (
    <MyChats role={profile.role} />
  )}

        

        <section>
          <h2>
            ⭐ 推薦地政士
          </h2>

          <div>
            <h3>
              王○○地政士
            </h3>

            <p>
              📍 桃園市
            </p>

            <p>
              ⭐⭐⭐⭐⭐
            </p>

            <p>
              專長：買賣、繼承、節稅
            </p>
          </div>

          <div>
            <h3>
              陳○○地政士
            </h3>

            <p>
              📍 新北市
            </p>

            <p>
              ⭐⭐⭐⭐⭐
            </p>

            <p>
              專長：土地、農地規劃
            </p>
          </div>
        </section>

        
      </main>

      <BackToTop />

      <Footer onOpenAdminLogin={() => openAuth("login")} />
    </div>
  );
}

export default App;