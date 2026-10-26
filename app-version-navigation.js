// Keep the retained full-featured page separate from the current APP workflow.
(() => {
  const legacy = location.pathname.endsWith('/app-version-legacy.html');
  const currentNav = document.querySelector('#appVersionNav');
  currentNav.textContent = legacy ? 'APP 版本管理(旧)' : 'APP版本管理';
  const otherNav = document.createElement('li');
  otherNav.id = legacy ? 'currentAppVersionNav' : 'legacyAppVersionNav';
  otherNav.textContent = legacy ? 'APP版本管理' : 'APP 版本管理(旧)';
  otherNav.setAttribute('role', 'button');
  otherNav.tabIndex = 0;
  otherNav.style.cursor = 'pointer';
  const navigate = () => {
    location.href = (legacy ? 'index.html' : 'app-version-legacy.html') + '?v=20261026-release';
  };
  otherNav.onclick = navigate;
  otherNav.onkeydown = event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigate();
    }
  };
  if (legacy) currentNav.before(otherNav);
  else currentNav.after(otherNav);
  // Retain the old page for reference without exposing its navigation entry.
  (legacy ? currentNav : otherNav).hidden = true;
  if (legacy) {
    document.querySelector('.list-breadcrumb .crumb-current').textContent = 'APP 版本管理(旧)';
    document.querySelector('#backBtn').textContent = 'APP 版本管理(旧)';
  }
  // Accommodate the longer legacy menu label without clipping.
  document.querySelector('.side').style.width = '188px';
  document.querySelector('.side').style.flexBasis = '188px';
})();
