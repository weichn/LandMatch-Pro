function Header({ onOpenAuth, isLoggedIn, onLogout }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <button
          type="button"
          className="site-brand"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <div>
            <h1>🏠 地政媒合通</h1>
            <p>LandMatch｜全台地政士媒合平台</p>
          </div>
        </button>

        <div className="header-actions">
          {isLoggedIn ? (
            <button
              type="button"
              className="header-login-button"
              onClick={onLogout}
            >
              登出
            </button>
          ) : (
            <>
              <button
                type="button"
                className="header-login-button"
                onClick={() => onOpenAuth("login")}
              >
                登入
              </button>

              <button
                type="button"
                className="header-signup-button"
                onClick={() => onOpenAuth("signup")}
              >
                免費註冊
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;