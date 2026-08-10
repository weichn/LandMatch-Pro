function Header({ onOpenAuth }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <div className="site-brand">
          

          <div>
            <h1>🏠 LandMatch</h1>
            <p>全台地政士媒合平台</p>
          </div>
        </div>

        <div className="header-actions">
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
        </div>
      </div>
    </header>
  );
}

export default Header;