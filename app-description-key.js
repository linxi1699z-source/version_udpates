// All APP workflows use the shared 18-language description editor.
(() => {
  const previousCollect = collectFormSettings;
  collectFormSettings = function() {
    const settings = previousCollect();
    delete settings.versionDescriptionKey;
    delete settings.versionDescriptionEnabled;
    return settings;
  };
  const previousValidate = validateForm;
  validateForm = function() {
    if (!previousValidate()) return false;
    const empty = [...document.querySelectorAll('#languages .normal-description')].find(field => !field.value.trim());
    return empty ? validationError('请填写所有语种对应描述', empty) : true;
  };
  const previousUpload = xlsxInput.onchange;
  xlsxInput.onchange = async function(event) {
    const file = this.files[0];
    if (file && !/\.xlsx$/i.test(file.name)) {
      toast('请上传 .xlsx 格式文件');
      this.value = '';
      return;
    }
    await previousUpload.call(this, event);
  };
})();
