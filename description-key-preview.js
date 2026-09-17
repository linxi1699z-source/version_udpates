// Local prototype fixtures; replace lookup with the multilingual service when integrated.
(() => {
  const messages = {
    app_upgrade_description: {
      zh: '优化使用体验，修复已知问题，建议升级至最新版本。',
      en: 'Improve your experience and fix known issues. Update to the latest version.'
    },
    app_force_upgrade_description: {
      zh: '当前版本已不再支持，请升级至最新版本后继续使用。',
      en: 'This version is no longer supported. Please update to the latest version to continue.'
    },
    app_sleep_upgrade_description: {
      zh: '睡眠功能已升级，请更新至最新版本以查看完整睡眠数据。',
      en: 'Sleep features have been improved. Update to the latest version to view your complete sleep data.'
    }
  };
  function sync(input) {
    if (!input) return;
    let preview = input.parentElement.querySelector('.description-key-preview');
    if (!preview) {
      preview = document.createElement('div');
      preview.className = 'description-key-preview';
      preview.setAttribute('aria-live', 'polite');
      preview.style.cssText = 'margin-top:10px;padding:12px;background:#f5f7fa;border:1px solid #e5eaf1;line-height:1.7;overflow-wrap:anywhere;white-space:pre-wrap';
      input.after(preview);
      const hint = document.createElement('div');
      hint.className = 'mini-note';
      hint.textContent = '原型示例 Key：app_upgrade_description、app_force_upgrade_description、app_sleep_upgrade_description';
      preview.after(hint);
    }
    const key = input.value.trim();
    preview.hidden = !key;
    preview.style.display = key ? 'block' : 'none';
    const value = Object.hasOwn(messages, key) ? messages[key] : null;
    preview.textContent = value
      ? '中文：' + value.zh + '\n英文：' + value.en
      : key ? '未找到对应文案' : '';
  }
  window.DescriptionKeyPreview = { sync };
  document.addEventListener('input', event => {
    if (event.target.matches('#appDescriptionKey, #fxDescriptionKey')) sync(event.target);
  });
})();
