// Keep the legacy multilingual editor for the copy workflow.
(() => {
  const legacyRow = document.querySelector('#descriptionLabel').closest('.form-row');
  legacyRow.insertAdjacentHTML('beforebegin', `
    <div class="form-row" id="appDescriptionKeyRow" style="display:none">
      <label class="required" for="appDescriptionKey">版本描述 Key：</label>
      <div class="control"><input id="appDescriptionKey" type="text" required aria-required="true" placeholder="请输入版本描述 Key"></div>
    </div>`);
  const keyRow = document.querySelector('#appDescriptionKeyRow');
  const keyInput = document.querySelector('#appDescriptionKey');
  function sync() {
    const keyMode = formMode !== 'copy';
    legacyRow.style.display = keyMode ? 'none' : '';
    keyRow.style.display = keyMode ? '' : 'none';
    keyInput.required = keyMode;
    window.DescriptionKeyPreview.sync(keyInput);
  }
  const previousOpen = openForm;
  openForm = function(mode, row = null, index = null, sourceSite = siteSelect.value) {
    previousOpen(mode, row, index, sourceSite);
    keyInput.value = row?.[9]?.versionDescriptionKey || '';
    sync();
  };
  const previousCollect = collectFormSettings;
  collectFormSettings = function() {
    const settings = previousCollect();
    if (formMode !== 'copy') {
      settings.versionDescriptionEnabled = true;
      settings.versionDescriptionKey = keyInput.value.trim();
    }
    return settings;
  };
  const previousValidate = validateForm;
  validateForm = function() {
    if (formMode !== 'copy' && !keyInput.value.trim()) {
      return validationError('请输入版本描述 Key', keyInput);
    }
    return previousValidate();
  };
  sync();
})();
