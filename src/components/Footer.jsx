function Footer({ onOpenAdminLogin }) {
  return (
    <footer className="site-footer">
      <p>
        © 2026 桓宸 HUAN CHEN ・ 本平台僅提供地政士／代書資訊查找與案件媒合功能，
        不參與居間仲介或代理收付款項。
      </p>

      <div className="footer-links">
        <a
          className="admin-login-link"
          href="/privacy.html"
        >
          隱私權政策
        </a>

        <span aria-hidden="true">
          ・
        </span>

        <a
          className="admin-login-link"
          href="/delete-account.html"
        >
          刪除帳號
        </a>

        <span aria-hidden="true">
          ・
        </span>

        <button
          type="button"
          className="admin-login-link"
          onClick={onOpenAdminLogin}
        >
          營運管理登入
        </button>
      </div>
    </footer>
  );
}

export default Footer;