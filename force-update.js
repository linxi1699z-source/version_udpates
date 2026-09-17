(() => {
  'use strict';

  const versionPattern = /^[1-9]\d{0,8}\.\d{1,9}\.\d{1,9}$/;
  function compareVersion(a, b) {
    const left = a.split('.').map(Number), right = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] - right[i];
    return 0;
  }
  function containsVersion(range, version) {
    const lower = compareVersion(version, range.start);
    const upper = range.end ? compareVersion(version, range.end) : -1;
    return lower >= 0 && (!range.end || upper <= 0);
  }
  function rangesOverlap(a, b) {
    // Both boundaries are inclusive; an omitted end is positive infinity.
    const before = (left, right) => left.end && compareVersion(left.end, right.start) < 0;
    return !before(a, b) && !before(b, a);
  }
  function rangeIssue(range, complete = false, requireEnd = false) {
    if (complete && !range.start) return '请输入开始版本号';
    if (complete && requireEnd && !range.end) return '请输入结束版本号';
    if ((range.start && !versionPattern.test(range.start)) || (range.end && !versionPattern.test(range.end))) {
      return '请输入正确的版本号';
    }
    if (range.start && range.end) {
      const comparison = compareVersion(range.start, range.end);
      if (comparison > 0) return '开始版本需要小于等于结束版本';
    }
    return '';
  }
  function overlappingIndex(ranges) {
    for (let i = 0; i < ranges.length; i++) for (let j = i + 1; j < ranges.length; j++) {
      if (rangesOverlap(ranges[i], ranges[j])) return j;
    }
    return -1;
  }
  function hasActiveConflict(records, site, platform, excludedId = null) {
    return records.some(record => record.id !== excludedId && record.active && record.site === site && record.platform === platform);
  }
  function hasFirmwareConflict(records, site, model, excludedId = null) {
    return records.some(record => record.id !== excludedId && record.active && record.site === site && record.model === model);
  }
  function audienceIssue(a) {
    if(a.mode==='auto')return /^[1-9]\d*$/.test(a.days)?'':'请输入大于 0 的整数活跃天数';
    if(a.ids.some(id=>!/^\d+$/.test(id)))return '用户 ID 只能输入整数';
    if(a.tails&&!/^\d(?:\s*[,，]\s*\d)*$/.test(a.tails))return '用户 ID尾数只能填写 0–9，以逗号分隔';
    const ranges=a.ranges.filter(r=>r.start||r.end);
    if(!a.ids.length&&!a.tails&&!ranges.length)return '请填写灰度用户信息';
    for(const r of ranges){
      if(!r.start)return '请输入开始 ID';
      if(!/^\d+$/.test(r.start)||(r.end&&!/^\d+$/.test(r.end)))return '用户 ID 只能输入整数';
      if(r.end&&BigInt(r.start)>BigInt(r.end))return '开始 ID 需要小于等于结束 ID';
    }
    for(let i=0;i<ranges.length;i++)for(let j=i+1;j<ranges.length;j++){
      const x=ranges[i],y=ranges[j];
      if(!(x.end&&BigInt(x.end)<BigInt(y.start))&&!(y.end&&BigInt(y.end)<BigInt(x.start)))return '用户ID区间重复';
    }
    return '';
  }
  const rules = { audienceIssue, versionPattern, compareVersion, containsVersion, rangesOverlap, rangeIssue, overlappingIndex, hasActiveConflict, hasFirmwareConflict };
  if (typeof document === 'undefined') { module.exports = rules; return; }

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const copy = value => JSON.parse(JSON.stringify(value));
  const sites = [{ id:'cn', name:'中国大陆' }, { id:'us', name:'美区' }, { id:'uk', name:'英区' }];
  const platforms = ['Android', 'iOS', 'HarmonyOS'];
  const platformLabel = platform => platform === 'HarmonyOS' ? 'Harmony OS' : platform;
  const siteLabel = id => sites.find(site => site.id === id)?.name || '';
  const storeKey = 'app-version-force-update-management-v1';
  const timeString = () => {
    const now = new Date(), two = n => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${two(now.getMonth()+1)}-${two(now.getDate())} ${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`;
  };
  const descriptions = [
    '睡眠功能升级，请升级到最新版本，否则相关功能将不可用。',
    '设备连接协议已更新，请升级 APP 以继续同步戒指数据。',
    '健康趋势页面已升级，请更新至最新版本以查看完整数据。',
    '修复重要兼容性问题，请升级 APP 后继续使用。'
  ];
  function seedData() {
    let id = 0;
    const records = sites.flatMap(site => Array.from({ length:3 }, (_, index) => ({
      id:++id, site:site.id, platform:platforms[index % 3], description:descriptions[index % 4],
      mode:index === 0 ? 'all' : 'specified',
      ranges:[{ start:'4.0.0', startOp:'>=', end:index % 4 === 1 ? '' : `4.2.${index % 10}`, endOp:'<=' }],
      active:index % 4 !== 2, operator:index % 2 ? '王明' : '李莹灿',
      updated:`2026-09-${String(1 + index % 9).padStart(2,'0')} 10:${String(index*4).padStart(2,'0')}:00`
    })));
    return { records, nextId:id + 1 };
  }
  let database;
  try {
    const saved = JSON.parse(sessionStorage.getItem(storeKey));
    database = saved && Array.isArray(saved.records) && Number.isInteger(saved.nextId) ? saved : seedData();
  } catch { database = seedData(); }
  database.records.forEach(record => (record.ranges || []).forEach(range => {
    range.startOp = '>='; range.endOp = '<=';
  }));
  const save = () => sessionStorage.setItem(storeKey, JSON.stringify(database));
  let activeSite = 'cn', page = 1, perPage = 10, filters = { status:'all', platforms:[...platforms] };
  let siteSwitchTimer = null;
  let groups = [], draftDescriptions = {}, editId = null, deleteId = null, groupSerial = 0, draftEpoch = 0;
  const defaultDescriptionKey = 'app_force_upgrade_description';
  let descriptionEnabled = false, descriptionKey = defaultDescriptionKey, useDescriptionKey = true;
  const emptyDescriptions = () => Object.fromEntries(langs.map(language => [language, '']));
  const recordDescriptions = record => ({ ...emptyDescriptions(), ...(record.descriptions || { 中文:record.description || '' }) });
  const listDescription = record => typeof record.descriptionEnabled === 'boolean'
    ? (record.descriptionEnabled ? record.descriptionKey || '—' : '—')
    : record.descriptions
    ? record.descriptions[activeSite === 'cn' ? '中文' : '英语'] || record.descriptions.中文 || '—'
    : record.description || '—';
  let previousFocus = null;
  let firmwareFormActive = false, fgEditId = null, fgDraft = null;
  const newRange = () => ({ start:'', end:'', startOp:'>=', endOp:'<=' });
  const newSiteConfig = () => ({ mode:'all', ranges:[newRange()] });
  const newGroup = (site = activeSite) => ({ uid:++groupSerial, platform:'Android', sites:site ? [site] : [], configs:{} });
  const configFor = (group, site) => group.configs[`${group.platform}:${site}`] ||= newSiteConfig();
  const appVersions = (site, platform) => [...new Set(siteData[site === 'cn' ? 'cn' : 'global']
    .filter(row => (row[1] === '安卓' ? 'Android' : row[1]) === platform).map(row => row[0]))].sort(compareVersion);

  const nav = document.createElement('li');
  nav.id = 'forceUpdateNav'; nav.textContent = '版本升级配置'; nav.tabIndex = 0; nav.role = 'button'; nav.style.cursor = 'pointer';
  $('#appVersionNav').after(nav);
  const main = $('main');
  main.insertAdjacentHTML('beforeend', `
    <section class="panel fx-page" id="fxList" hidden>
      <div class="list-header"><div class="breadcrumb"><svg class="home-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 12 3l9 8v10h-6v-7H9v7H3z"/></svg><span>运营中心</span><b>&gt;</b><span class="crumb-current">版本升级配置</span></div>
        <label class="site-control">站点：<select id="fxSite">${sites.map(site => `<option value="${site.id}">${site.name}</option>`).join('')}</select></label></div>
      <div class="fx-tabs" role="tablist" aria-label="版本升级配置">
        <button type="button" class="fx-tab" id="fxAppTab" role="tab" aria-controls="fxAppTabPanel" aria-selected="true">APP强制升级</button>
        <button type="button" class="fx-tab" id="fxFirmwareTab" role="tab" aria-controls="fxFirmwareTabPanel" aria-selected="false" tabindex="-1" hidden>固件升级(灰度)-后期功能</button>
      </div>
      <div id="fxAppTabPanel" role="tabpanel" aria-labelledby="fxAppTab">
      <div class="filter-bar"><div class="filter-controls">
        <div class="filter-item">平台：<div class="multi-select" id="fxPlatformFilter"><button type="button" class="multi-select-toggle" id="fxPlatformFilterToggle" aria-label="筛选平台" aria-expanded="false">Android,iOS,Harmony OS</button><div class="multi-select-menu">${platforms.map(platform => `<label class="multi-option"><input type="checkbox" value="${platform}" checked>${platformLabel(platform)}</label>`).join('')}</div></div></div>
        <label class="filter-item">状态：<select id="fxStatusFilter"><option value="all">所有状态</option><option value="active">已生效</option><option value="inactive">已失效</option></select></label>
        <button class="secondary" id="fxSearch">搜索</button></div>
        <div class="filter-actions"><button class="primary" id="fxAdd">新增</button></div></div>
      <div class="fx-table-scroll"><table class="fx-table"><colgroup><col style="width:65px"><col style="width:110px"><col style="width:240px"><col style="width:145px"><col style="width:260px"><col style="width:100px"><col style="width:175px"><col style="width:85px"></colgroup>
        <thead><tr><th>编号</th><th>平台</th><th>版本号范围</th><th>状态</th><th>强制升级描述</th><th>操作人</th><th>更新时间</th><th>操作</th></tr></thead><tbody id="fxRows"></tbody></table></div>
      <div class="pagination" id="fxPagination"></div>
      </div>
      <div id="fxFirmwareTabPanel" role="tabpanel" aria-labelledby="fxFirmwareTab" hidden></div>
    </section>
    <section class="panel fx-page" id="fxCreate" hidden>
      <div class="breadcrumb"><span>运营中心</span><b>&gt;</b><span class="crumb-link" id="fxCreateBack">版本升级配置</span><b>&gt;</b><span>APP强制升级</span><b>&gt;</b><span class="crumb-current">新增强制升级版本</span></div>
      <div class="fx-form" id="fxCreateForm"></div>
      <div class="form-footer fx-form-footer"><button class="secondary" id="fxCreateCancel">取消</button><button class="primary" id="fxCreateSubmit">提交</button></div>
    </section>
    <section class="panel fx-page" id="fxEdit" hidden>
      <div class="breadcrumb"><span>运营中心</span><b>&gt;</b><button type="button" class="crumb-link fx-text-button" id="fxEditBack">版本升级配置</button><b>&gt;</b><span>APP强制升级</span><b>&gt;</b><span class="crumb-current">编辑强制升级版本</span></div>
      <div class="fx-form" id="fxEditForm"></div>
      <div class="form-footer fx-form-footer"><button class="secondary" id="fxEditCancel">取消</button><button class="primary" id="fxEditSubmit">提交</button></div>
    </section>`);
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-backdrop fx-modal fx-delete-modal" id="fxDeleteModal" role="dialog" aria-modal="true" aria-labelledby="fxDeleteTitle" hidden>
      <div class="modal"><div class="modal-header"><strong class="modal-title" id="fxDeleteTitle">删除配置</strong></div><p>确定要删除配置吗？</p><div class="modal-footer"><button class="secondary" id="fxDeleteCancel">取消</button><button class="primary" id="fxDeleteConfirm">确定</button></div></div></div>`);

  function showModal(id) {
    previousFocus = document.activeElement;
    const modal = $(id); modal.hidden = false; modal.classList.add('show');
    $('button', modal)?.focus();
  }
  function closeModal(id) {
    const modal = $(id); modal.hidden = true; modal.classList.remove('show');
    if (previousFocus?.isConnected) previousFocus.focus();
  }
  function activateNavigation() {
    $$('.nav li').forEach(item => item.classList.toggle('active', item === nav));
    $('.list-page').style.display = 'none'; $('.form-page').style.display = 'none';
  }
  function showForceList() {
    firmwareFormActive = false; $('#fgPage')?.setAttribute('hidden', '');
    editId = null; draftEpoch++;
    activateNavigation(); $('#fxList').hidden = false; $('#fxCreate').hidden = true; $('#fxEdit').hidden = true;
    selectUpgradeTab('app');
    renderList(); window.scrollTo(0, 0);
  }
  function selectUpgradeTab(tab) {
    const isApp = tab === 'app';
    if (siteSwitchTimer !== null) {
      clearTimeout(siteSwitchTimer); siteSwitchTimer = null;
      $('#fxSite').value = activeSite;
      setSiteSwitchLoading(false, '', $('#fxList'), $('#fxSite'));
    }
    $('#fxAppTabPanel').hidden = !isApp; $('#fxFirmwareTabPanel').hidden = isApp;
    $('#fxSite').closest('.site-control').hidden = false;
    if (!isApp) renderFirmwareList();
    [['#fxAppTab', isApp], ['#fxFirmwareTab', !isApp]].forEach(([selector, selected]) => {
      $(selector).setAttribute('aria-selected', String(selected)); $(selector).tabIndex = selected ? 0 : -1;
    });
    closePlatformFilter();
    history.replaceState(null, '', isApp ? '#version-upgrade/app-force' : '#version-upgrade/firmware-gray');
  }
  $('#fxAppTab').onclick = () => selectUpgradeTab('app');
  $('#fxFirmwareTab').onclick = () => selectUpgradeTab('firmware');
  $('.fx-tabs').onkeydown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const isApp = event.key === 'Home' || (event.key !== 'End' && event.target.id === 'fxFirmwareTab');
    selectUpgradeTab(isApp ? 'app' : 'firmware'); $(isApp ? '#fxAppTab' : '#fxFirmwareTab').focus();
  };
  const originalAppClick = $('#appVersionNav').onclick;
  function leaveForceManagement(event) {
    firmwareFormActive = false; $('#fgPage')?.setAttribute('hidden', '');
    if (siteSwitchTimer !== null) {
      clearTimeout(siteSwitchTimer); siteSwitchTimer = null;
      $('#fxSite').value = activeSite;
      setSiteSwitchLoading(false, '', $('#fxList'), $('#fxSite'));
    }
    editId = null; draftEpoch++;
    $('#fxList').hidden = true; $('#fxCreate').hidden = true; $('#fxEdit').hidden = true;
    closeModal('#fxDeleteModal');
    closeModal('#fgDeleteModal');
    $$('.nav li').forEach(item => item.classList.toggle('active', item.id === 'appVersionNav'));
    originalAppClick?.(event);
    if (location.hash === '#force-update' || location.hash.startsWith('#version-upgrade/')) history.replaceState(null, '', '#app-version');
  }
  $('#appVersionNav').onclick = leaveForceManagement;
  $('#appVersionNav').onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); leaveForceManagement(event); } };
  nav.onclick = showForceList;
  nav.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showForceList(); } };
  function matchingRecords() {
    return database.records.filter(record => record.site === activeSite &&
      filters.platforms.includes(record.platform) &&
      (filters.status === 'all' || record.active === (filters.status === 'active')))
      .sort((a, b) => b.id - a.id);
  }
  function rangeText(record) {
    return record.mode === 'all' ? '全部版本' : record.ranges.map(range => `<span class="fx-range-display">${escape(range.startOp)} ${escape(range.start)}${range.end ? ` &amp; ${escape(range.endOp)} ${escape(range.end)}` : ''}</span>`).join('');
  }
  function pageNumbers(total) {
    if (total <= 7) return Array.from({ length:total }, (_, i) => i + 1);
    const pages = new Set([1, total, page-1, page, page+1]);
    if (page <= 3) [2,3,4,5].forEach(number => pages.add(number));
    if (page >= total-2) [total-4,total-3,total-2,total-1].forEach(number => pages.add(number));
    const sorted = [...pages].filter(number => number >= 1 && number <= total).sort((a,b) => a-b), output = [];
    sorted.forEach((number, i) => { if (i && number - sorted[i-1] > 1) output.push('…'); output.push(number); });
    return output;
  }
  function renderList() {
    const records = matchingRecords(), totalPages = Math.max(1, Math.ceil(records.length / perPage));
    page = Math.max(1, Math.min(page, totalPages));
    $('#fxRows').innerHTML = records.slice((page-1)*perPage, page*perPage).map(record => `<tr>
      <td>${record.id}</td><td>${escape(platformLabel(record.platform))}</td><td>${rangeText(record)}</td>
      <td><div class="fx-status"><label class="switch"><input type="checkbox" data-fx-status="${record.id}" aria-label="配置 ${record.id} 生效状态" ${record.active ? 'checked' : ''}><span class="slider"></span></label><span class="${record.active ? '' : 'fx-state-off'}">${record.active ? '已生效' : '已失效'}</span></div></td>
      <td class="fx-description-preview">${escape(listDescription(record))}</td><td>${escape(record.operator)}</td><td>${escape(record.updated)}</td><td class="fx-row-actions"><button class="fx-text-button" data-fx-edit="${record.id}">编辑</button><button class="fx-text-button fx-danger" data-fx-delete="${record.id}" hidden>删除</button></td></tr>`).join('') || '<tr><td colspan="8" class="empty-state">暂无符合筛选条件的数据</td></tr>';
    $('#fxPagination').innerHTML = `<span>共 ${records.length} 条</span><select class="page-size" aria-label="强制更新每页条数" id="fxPageSize">${[10,20,50].map(size => `<option value="${size}" ${perPage === size ? 'selected' : ''}>${size}条/页</option>`).join('')}</select>
      <button class="page-btn" data-fx-page="${page-1}" ${page === 1 ? 'disabled' : ''}>‹</button>${pageNumbers(totalPages).map(number => number === '…' ? '<span class="page-ellipsis">…</span>' : `<button class="page-btn ${number === page ? 'active' : ''}" data-fx-page="${number}">${number}</button>`).join('')}
      <button class="page-btn" data-fx-page="${page+1}" ${page === totalPages ? 'disabled' : ''}>›</button><span>前往</span><input class="page-jump" id="fxPageJump" aria-label="强制更新跳转页码" inputmode="numeric" value="${page}"><span>页</span>`;
  }
  $('#fxSite').onchange = event => {
    if (siteSwitchTimer !== null) return;
    const targetSite = event.target.value;
    if (targetSite === activeSite) return;
    const targetName = siteLabel(targetSite);
    setSiteSwitchLoading(true, targetName, $('#fxList'), $('#fxSite'));
    siteSwitchTimer = window.setTimeout(() => {
      try {
        activeSite = targetSite; page = 1; fgPage = 1; renderList(); renderFirmwareList();
      } finally {
        siteSwitchTimer = null;
        setSiteSwitchLoading(false, '', $('#fxList'), $('#fxSite'));
      }
      toast(`站点已切换到${targetName}`);
    }, 520);
  };
  const platformFilter = $('#fxPlatformFilter'), platformToggle = $('#fxPlatformFilterToggle');
  function closePlatformFilter() { platformFilter.classList.remove('open'); platformToggle.setAttribute('aria-expanded', 'false'); }
  function updatePlatformFilter() {
    filters.platforms = $$('input:checked', platformFilter).map(input => input.value);
    platformToggle.textContent = filters.platforms.map(platformLabel).join(',') || '请选择平台';
  }
  platformToggle.onclick = () => platformToggle.setAttribute('aria-expanded', String(platformFilter.classList.toggle('open')));
  platformFilter.addEventListener('change', () => { updatePlatformFilter(); page = 1; renderList(); });
  document.addEventListener('click', event => { if (!platformFilter.contains(event.target)) closePlatformFilter(); });
  platformFilter.addEventListener('keydown', event => { if (event.key === 'Escape') { closePlatformFilter(); platformToggle.focus(); } });
  function search() {
    filters = { ...filters, status:$('#fxStatusFilter').value }; page = 1; renderList();
  }
  $('#fxSearch').onclick = search;

  function renderRange(group, site, range, index, versions, total) {
    const id = `fxVersions-${group.uid}-${site}-${index}`;
    return `<div class="fx-range" data-fx-range="${index}">
      <div class="fx-bound">${firmwareFormActive?'':'<span class="fx-required-bound" aria-hidden="true">*</span>'}<span class="fx-bound-operator" aria-label="开始版本比较符号，固定大于等于">&gt;=</span><input data-fx-bound="start" ${firmwareFormActive?'':'required aria-required="true"'} list="${id}" value="${escape(range.start)}" placeholder="请输入开始版本号" aria-label="${siteLabel(site)}开始版本号 ${index+1}" inputmode="decimal"></div><span>—</span>
      <div class="fx-bound">${firmwareFormActive?'':'<span class="fx-required-bound" aria-hidden="true">*</span>'}<span class="fx-bound-operator" aria-label="结束版本比较符号，固定小于等于">&lt;=</span><input data-fx-bound="end" ${firmwareFormActive?'':'required aria-required="true"'} list="${id}" value="${escape(range.end)}" placeholder="${firmwareFormActive?'结束版本号（可不填）':'请输入结束版本号'}" aria-label="${siteLabel(site)}结束版本号 ${index+1}" inputmode="decimal"></div>
      ${total > 1 ? '<button type="button" class="fx-text-button fx-danger" data-fx-remove-range>删除区间</button>' : ''}
      <datalist id="${id}">${versions.map(version => `<option value="${escape(version)}"></option>`).join('')}</datalist><p class="fx-range-error" aria-live="polite"></p></div>`;
  }
  function renderSite(group, site) {
    const config = configFor(group, site), versions = appVersions(site, group.platform);
    return `<section class="fx-site-card" data-fx-site="${site}"><div class="fx-site-head"><strong>${siteLabel(site)}APP版本</strong><span class="mini-note">当前最新版本：${escape(versions.at(-1) || '暂无版本')}</span></div>
      <label class="radio"><input type="radio" name="fx-mode-${group.uid}-${site}" data-fx-mode="all" ${config.mode === 'all' ? 'checked' : ''}>全部版本</label><label class="radio"><input type="radio" name="fx-mode-${group.uid}-${site}" data-fx-mode="specified" ${config.mode === 'specified' ? 'checked' : ''}>指定版本号</label>
      ${config.mode === 'specified' ? `<div class="fx-ranges">${config.ranges.map((range,index) => renderRange(group,site,range,index,versions,config.ranges.length)).join('')}</div><button type="button" class="fx-text-button" data-fx-add-range>＋ 新增区间</button>` : ''}</section>`;
  }
  function renderGroup(group, index) {
    const isEdit = editId !== null;
    const siteLocked = isEdit || (firmwareFormActive && fgEditId !== null);
    return `<section class="fx-group" data-fx-group="${group.uid}">
      ${isEdit ? '' : `<div class="fx-group-head"><span>配置组 ${index+1}</span>${groups.length > 2 ? '<button type="button" class="fx-text-button fx-danger" data-fx-remove-group>删除配置组</button>' : ''}</div>`}
      <div class="form-row"><label class="required">平台：</label><div class="control"><select class="fx-platform" aria-label="配置平台" ${isEdit ? 'disabled' : ''}>${platforms.map(platform => `<option value="${platform}" ${platform === group.platform ? 'selected' : ''}>${platformLabel(platform)}</option>`).join('')}</select></div></div>
      <div class="form-row"><label class="required">站点：</label><div class="control fx-site-options">${siteLocked ? `<span>${siteLabel(group.sites[0])}</span>` : sites.map(site => `<label class="check"><input type="checkbox" data-fx-site-choice="${site.id}" ${group.sites.includes(site.id) ? 'checked' : ''}>${site.name}</label>`).join('')}</div></div>
      ${group.sites.map(site => renderSite(group, site)).join('')}
      ${group.sites.length ? '' : '<p class="mini-note">请选择需要配置的站点</p>'}</section>`;
  }
  const formRoot = () => $(firmwareFormActive ? '#fgForm' : editId === null ? '#fxCreateForm' : '#fxEditForm');
  function resizeDescription(textarea) {
    if (!textarea.getClientRects().length) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(38, textarea.scrollHeight + 2)}px`;
  }
  function renderDescriptions() {
    if (!firmwareFormActive && useDescriptionKey) {
      return `<div class="form-row"><label>强制升级描述：</label><div class="control">
        <label class="radio"><input type="radio" name="fxDescriptionEnabled" value="yes" ${descriptionEnabled ? 'checked' : ''}>是</label>
        <label class="radio"><input type="radio" name="fxDescriptionEnabled" value="no" ${!descriptionEnabled ? 'checked' : ''}>否</label>
      </div></div>${descriptionEnabled ? `<div class="form-row"><label for="fxDescriptionKey">强制升级描述Key：</label><div class="control"><input type="text" id="fxDescriptionKey" value="${escape(descriptionKey)}" placeholder="请输入强制升级描述Key"></div></div>` : ''}`;
    }
    const markup = `<div class="form-row fx-description-row"><label>强制升级描述：</label><div class="control">
      <div class="fx-description-toolbar"><div class="upload"><button type="button" class="file-btn">上传描述<input type="file" class="fx-description-upload" accept=".xlsx" aria-label="上传强制升级描述"></button><span>文件大小 ≤ 5M</span><a class="template-download" href="outputs/upgrade-description-templates/强制升级描述模板.xlsx?v=20260911" download="强制升级描述模板.xlsx">下载模板</a></div></div>
      <table class="fx-description-table"><thead><tr><th>语种</th><th>强制升级描述</th></tr></thead><tbody>${langs.map(language => `<tr><td>${language}</td><td><textarea rows="1" class="fx-description" data-fx-language="${language}" aria-label="${language}强制升级描述" placeholder="请输入${language}强制升级描述" ${language === '阿拉伯语' ? 'dir="auto"' : ''}>${escape(draftDescriptions[language])}</textarea></td></tr>`).join('')}</tbody></table>
      </div></div>`;
    return firmwareFormActive ? markup.replaceAll('强制升级描述', '升级描述').replaceAll('强制升级描述模板', '升级描述模板') : markup;
  }
  function renderForm() {
    if (firmwareFormActive) { renderFirmwareForm(); return; }
    const root = formRoot();
    root.innerHTML = `<p class="fx-error-summary" role="alert"></p>
      <div class="form-row fx-config-row"><label>强制升级版本：</label><div class="control fx-config-control">${groups.map(renderGroup).join('')}
      ${editId === null ? '<button type="button" class="secondary fx-group-add" data-fx-add-group>＋ 新增配置组</button>' : ''}</div></div>${renderDescriptions()}`;
    window.DescriptionKeyPreview.sync($('#fxDescriptionKey', root));
    requestAnimationFrame(() => $$('.fx-description', root).forEach(resizeDescription));
  }
  function create() {
    editId = null; draftEpoch++; draftDescriptions = emptyDescriptions(); groups = [newGroup()];
    useDescriptionKey = true; descriptionEnabled = false; descriptionKey = defaultDescriptionKey;
    $('#fxList').hidden = true; $('#fxEdit').hidden = true; $('#fxCreate').hidden = false; renderForm(); window.scrollTo(0,0);
  }
  function edit(id) {
    const record = database.records.find(item => item.id === id && item.site === activeSite);
    if (!record) return;
    editId = id; draftEpoch++; draftDescriptions = recordDescriptions(record);
    useDescriptionKey = typeof record.descriptionEnabled === 'boolean';
    descriptionEnabled = record.descriptionEnabled === true;
    descriptionKey = record.descriptionKey ?? defaultDescriptionKey;
    const group = newGroup(record.site); group.platform = record.platform;
    group.configs[`${record.platform}:${record.site}`] = { mode:record.mode, ranges:copy(record.ranges.length ? record.ranges : [newRange()]) };
    groups = [group];
    activateNavigation(); $('#fxList').hidden = true; $('#fxCreate').hidden = true; $('#fxEdit').hidden = false;
    renderForm(); window.scrollTo(0,0);
  }
  function error(message, field) {
    $('.fx-error-summary', formRoot()).textContent = message; toast(message);
    field?.focus(); field?.scrollIntoView({ block:'center', behavior:'smooth' }); return false;
  }
  function validateDraft() {
    const combinations = new Set();
    const willBeActive = editId === null || database.records.find(record => record.id === editId)?.active;
    for (const group of groups) {
      const card = $(`[data-fx-group="${group.uid}"]`, formRoot());
      if (!group.sites.length) return error('请选择站点', $('[data-fx-site-choice]', card));
      for (const site of group.sites) {
        const key = `${group.platform}:${site}`;
        if (combinations.has(key)) return error('平台，站点数据重复', $('.fx-platform', card));
        combinations.add(key);
        if (willBeActive && hasActiveConflict(database.records, site, group.platform, editId)) {
          return error(`${platformLabel(group.platform)}在${siteLabel(site)}已经存在配置，无需重复添加。`, $('.fx-platform', card));
        }
        const config = configFor(group, site);
        if (config.mode === 'all') continue;
        const siteCard = $(`[data-fx-site="${site}"]`, card);
        for (let i = 0; i < config.ranges.length; i++) {
          const issue = rangeIssue(config.ranges[i], true, true);
          if (issue) return error(issue, $(`[data-fx-range="${i}"] input[data-fx-bound="${issue==='请输入结束版本号'?'end':'start'}"]`, siteCard));
        }
        const overlap = overlappingIndex(config.ranges);
        if (overlap >= 0) return error('版本号区间重复', $(`[data-fx-range="${overlap}"] input`, siteCard));
      }
    }
    return true;
  }
  function submit() {
    if (!validateDraft()) return;
    const stamp = timeString();
    if (editId !== null) {
      const record = database.records.find(item => item.id === editId);
      if (!record) { toast('配置不存在，请刷新列表'); return; }
      const config = configFor(groups[0], record.site);
      Object.assign(record, { description:draftDescriptions.中文 || '', descriptions:copy(draftDescriptions), mode:config.mode, ranges:config.mode === 'all' ? [] : copy(config.ranges), operator:'当前用户', updated:stamp });
      if (useDescriptionKey) Object.assign(record, { descriptionEnabled, descriptionKey:descriptionEnabled ? descriptionKey : '' });
      save(); showForceList(); toast('配置已保存');
    } else {
      // Validate every group before allocating IDs or creating any record.
      const records = groups.flatMap(group => group.sites.map(site => {
        const config = configFor(group, site);
        return { id:database.nextId++, site, platform:group.platform, description:draftDescriptions.中文 || '', descriptions:copy(draftDescriptions), descriptionEnabled, descriptionKey:descriptionEnabled ? descriptionKey : '', mode:config.mode,
          ranges:config.mode === 'all' ? [] : copy(config.ranges), active:true, operator:'当前用户', updated:stamp };
      }));
      database.records.push(...records); save(); filters = { status:'all', platforms:[...platforms] };
      $$('input', platformFilter).forEach(input => input.checked = true); updatePlatformFilter();
      $('#fxStatusFilter').value = 'all'; page = 1;
      if (!records.some(record => record.site === activeSite)) { activeSite = records[0].site; $('#fxSite').value = activeSite; }
      showForceList(); toast('成功');
    }
  }
  function formContext(element) {
    const groupCard = element.closest('[data-fx-group]');
    const group = groups.find(item => item.uid === Number(groupCard?.dataset.fxGroup));
    const site = element.closest('[data-fx-site]')?.dataset.fxSite;
    const platform = element.closest('[data-fg-platform]')?.dataset.fgPlatform || group?.platform;
    const config = group && site ? configFor({...group, platform}, site) : null;
    const rangeIndex = Number(element.closest('[data-fx-range]')?.dataset.fxRange);
    return { group, site, platform, config, rangeIndex };
  }
  function updateBound(element, reportFormat) {
    const { config, rangeIndex } = formContext(element);
    if (!config) return;
    const field = element.dataset.fxBound;
    if (field !== 'start' && field !== 'end') return;
    if (field === 'start' || field === 'end') element.value = element.value.replace(/[^\d.]/g, '');
    const range = config.ranges[rangeIndex]; range[field] = element.value.trim();
    const {platform,site} = formContext(element);
    const options = document.getElementById(element.dataset.designList || element.getAttribute('list'));
    if (options) options.innerHTML = appVersions(site, platform).filter(version => version.startsWith(element.value)).map(version => `<option value="${escape(version)}"></option>`).join('');
    const issue = rangeIssue(range);
    // Partial input such as "4." is valid while typing; compare completed versions immediately.
    const visibleIssue = !reportFormat && issue === '请输入正确的版本号' ? '' : issue;
    $('.fx-range-error', element.closest('.fx-range')).textContent = visibleIssue;
    if (visibleIssue && reportFormat) toast(visibleIssue);
  }
  const firmwareModels = ['Gen1','Gen2','Gen2 Air','Gen3','行业版'];
  const firmwareCatalog = {
    Gen1:['01.049.001','01.050.000','01.051.001'],
    Gen2:['02.013.000','02.022.006','02.023.001'],
    'Gen2 Air':['04.004.000','04.011.000','04.012.001'],
    Gen3:['05.001.000','05.011.003','05.012.001'],
    '行业版':['06.001.001','06.011.003','06.012.001']
  };
  const fgStoreKey = 'app-version-firmware-gray-v1';
  const sampleUpgradeDescriptions = Object.fromEntries(langs.map((language, index) => [language, [
    '优化设备连接稳定性，提升数据同步体验。','Improved device connection stability and data synchronization.','優化裝置連線穩定性，提升資料同步體驗。','Verbesserte Verbindungsstabilität und Datensynchronisierung.','Amélioration de la stabilité de connexion et de la synchronisation des données.','デバイス接続の安定性とデータ同期を改善しました。','Se mejoraron la estabilidad de conexión y la sincronización de datos.','تحسين استقرار اتصال الجهاز ومزامنة البيانات.','Vylepšena stabilita připojení zařízení a synchronizace dat.','Poprawiono stabilność połączenia i synchronizację danych.','Cihaz bağlantı kararlılığı ve veri eşitleme iyileştirildi.','Laitteen yhteyden vakautta ja tietojen synkronointia on parannettu.','Migliorate la stabilità della connessione e la sincronizzazione dei dati.','Javult az eszközkapcsolat stabilitása és az adatszinkronizálás.','Stabilitatea conexiunii și sincronizarea datelor au fost îmbunătățite.','기기 연결 안정성과 데이터 동기화를 개선했습니다.','Pagerintas įrenginio ryšio stabilumas ir duomenų sinchronizavimas.','Kestabilan sambungan peranti dan penyegerakan data dipertingkatkan.'
  ][index]]));
  function seedFirmwareData() {
    let id=0;
    return sites.flatMap(site => Array.from({length:12}, (_,i) => ({
      id:++id, site:site.id, model:firmwareModels[i%5], version:firmwareCatalog[firmwareModels[i%5]][i%3],
      mode:i%3 === 0 ? 'force' : 'normal', active:i<5 && i!==2, descriptions:copy(sampleUpgradeDescriptions),
      targets:(i%2 ? platforms.slice(0,2) : platforms).map((platform,j) => ({platform, mode:j===1?'all':'specified', ranges:j===1?[]:i%3===0?[{start:'4.0.0',end:'4.1.0',startOp:'>=',endOp:'<='},{start:'4.2.0',end:'',startOp:'>=',endOp:'<='}]:[{start:'4.0.0',end:'4.3.1',startOp:'>=',endOp:'<='}]}))
    })));
  }
  let fgRecords;
  try { const saved=JSON.parse(sessionStorage.getItem(fgStoreKey)); fgRecords=Array.isArray(saved)?saved:seedFirmwareData(); } catch { fgRecords=seedFirmwareData(); }
  let fgPage=1, fgPageSize=10, fgFilters={models:[...firmwareModels], version:'', mode:'all', status:'all'}, fgDeleteId=null;
  const saveFirmware = () => sessionStorage.setItem(fgStoreKey,JSON.stringify(fgRecords));
  function initializeFirmwareUI() {
    $('#fxFirmwareTabPanel').innerHTML=`<div class="filter-bar"><div class="filter-controls">
      <div class="filter-item">固件版本：<div class="multi-select" id="fgModels"><button type="button" class="multi-select-toggle" id="fgModelsToggle" aria-expanded="false">${firmwareModels.join(',')}</button><div class="multi-select-menu">${firmwareModels.map(model=>`<label class="multi-option"><input type="checkbox" value="${model}" checked>${model}</label>`).join('')}</div></div></div>
      <label class="filter-item">固件灰度版本：<input id="fgVersionSearch" placeholder="如 06 或 06.011.003" inputmode="decimal"></label>
      <label class="filter-item">升级方式：<select id="fgModeSearch"><option value="all">所有更新方式</option><option value="normal">非强制升级</option><option value="force">强制升级</option></select></label>
      <label class="filter-item">状态：<select id="fgStatusSearch"><option value="all">所有状态</option><option value="active">已生效</option><option value="inactive">已失效</option></select></label>
      <button class="secondary" id="fgSearch">搜索</button></div><div class="filter-actions"><button class="primary" id="fgAdd">新增</button></div></div>
      <div class="fx-table-scroll"><table class="fg-table"><colgroup><col style="width:110px"><col style="width:150px"><col style="width:350px"><col style="width:120px"><col style="width:145px"><col style="width:260px"><col style="width:110px"></colgroup><thead><tr><th>固件版本</th><th>固件灰度版本</th><th>适配APP版本</th><th>升级方式</th><th>状态</th><th>升级描述</th><th>操作</th></tr></thead><tbody id="fgRows"></tbody></table></div><div class="pagination" id="fgPagination"></div>`;
    main.insertAdjacentHTML('beforeend',`<section class="panel fx-page" id="fgPage" hidden><div class="breadcrumb"><span>运营中心</span><b>&gt;</b><button type="button" class="fx-text-button" id="fgBack">版本升级配置</button><b>&gt;</b><span>固件升级(灰度)</span><b>&gt;</b><span id="fgTitle"></span></div><div class="fx-form" id="fgForm"></div><div class="form-footer fx-form-footer"><button class="secondary" id="fgCancel">取消</button><button class="primary" id="fgSubmit">提交</button></div></section>`);
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop fx-modal fx-delete-modal" id="fgDeleteModal" role="dialog" aria-modal="true" aria-labelledby="fgDeleteTitle" hidden><div class="modal"><div class="modal-header"><strong id="fgDeleteTitle">删除配置</strong></div><p>确定要删除配置吗？</p><div class="modal-footer"><button class="secondary" id="fgDeleteCancel">取消</button><button class="primary" id="fgDeleteConfirm">确定</button></div></div></div>`);
    $('#fgModelsToggle').onclick=()=>$('#fgModelsToggle').setAttribute('aria-expanded',String($('#fgModels').classList.toggle('open')));
    $('#fgModels').onchange=()=>{fgFilters.models=$$('#fgModels input:checked').map(input=>input.value);$('#fgModelsToggle').textContent=fgFilters.models.join(',')||'请选择固件版本';fgPage=1;renderFirmwareList();};
    document.addEventListener('click',event=>{if(!$('#fgModels').contains(event.target)){$('#fgModels').classList.remove('open');$('#fgModelsToggle').setAttribute('aria-expanded','false');}});
    $('#fgVersionSearch').oninput=event=>event.target.value=event.target.value.replace(/[^\d.]/g,'');
    $('#fgSearch').onclick=()=>{const version=$('#fgVersionSearch').value.trim();if(version&&!/^\d{1,2}(?:\.\d{0,3})?(?:\.\d{0,3})?$/.test(version)){toast('请输入正确的固件灰度版本');return;}fgFilters={...fgFilters,version,mode:$('#fgModeSearch').value,status:$('#fgStatusSearch').value};fgPage=1;renderFirmwareList();};
    $('#fgVersionSearch').onkeydown=event=>{if(event.key==='Enter')$('#fgSearch').click();};
    $('#fgAdd').onclick=()=>openFirmwareForm();
    $('#fgCancel').onclick=$('#fgBack').onclick=returnFirmwareList;
    $('#fgSubmit').onclick=submitFirmware;
    $('#fgRows').onclick=event=>{const button=event.target.closest('button');if(button?.dataset.fgEdit)openFirmwareForm(Number(button.dataset.fgEdit));if(button?.dataset.fgDelete){fgDeleteId=Number(button.dataset.fgDelete);showModal('#fgDeleteModal');}};
    $('#fgRows').onchange=event=>{const record=fgRecords.find(record=>record.id===Number(event.target.dataset.fgStatus)&&record.site===activeSite);if(!record)return;if(event.target.checked&&hasFirmwareConflict(fgRecords,record.site,record.model,record.id)){event.target.checked=record.active;toast(`${record.model}在${siteLabel(record.site)}存在已生效配置。`);return;}record.active=event.target.checked;saveFirmware();renderFirmwareList();toast(record.active?'配置已生效':'配置已失效');};
    $('#fgDeleteCancel').onclick=()=>{fgDeleteId=null;closeModal('#fgDeleteModal');};
    $('#fgDeleteConfirm').onclick=()=>{fgRecords=fgRecords.filter(record=>record.id!==fgDeleteId);saveFirmware();closeModal('#fgDeleteModal');fgDeleteId=null;renderFirmwareList();toast('配置已删除');};
    $('#fgPagination').onclick=event=>{const button=event.target.closest('[data-fg-page]');if(button&&!button.disabled){fgPage=Number(button.dataset.fgPage);renderFirmwareList();}};
    $('#fgPagination').onchange=event=>{if(event.target.id==='fgPageSize'){fgPageSize=Number(event.target.value);fgPage=1;}if(event.target.id==='fgJump')fgPage=Math.max(1,Math.floor(Number(event.target.value))||1);renderFirmwareList();};
    $('#fgPagination').onkeydown=event=>{if(event.key==='Enter'&&event.target.id==='fgJump'){fgPage=Math.max(1,Math.floor(Number(event.target.value))||1);renderFirmwareList();}};
    $('#fgForm').addEventListener('input',event=>{if(event.target.id==='fgVersion'){fgDraft.version=event.target.value.replace(/[^\d.]/g,'');event.target.value=fgDraft.version;renderFirmwareOptions();}});
    $('#fgForm').addEventListener('change',event=>{
      if(event.target.id==='fgModel'){fgDraft.model=event.target.value;fgDraft.version='';renderForm();}
      if(event.target.name==='fgUpgradeMode')fgDraft.mode=event.target.value;
      const group=groups.find(item=>item.uid===Number(event.target.closest('[data-fx-group]')?.dataset.fxGroup));
      if(event.target.matches('.fg-group-site')&&group&&fgEditId===null){group.site=event.target.value;renderForm();}
      if(event.target.hasAttribute('data-fg-platform-choice')&&group){group.platforms=platforms.filter(platform=>platform===event.target.value?event.target.checked:group.platforms.includes(platform));renderForm();}
    });
  }
  function renderFirmwareList() {
    const records=fgRecords.filter(record=>record.site===activeSite&&fgFilters.models.includes(record.model)&&record.version.startsWith(fgFilters.version)&&(fgFilters.mode==='all'||record.mode===fgFilters.mode)&&(fgFilters.status==='all'||record.active===(fgFilters.status==='active'))).sort((a,b)=>b.id-a.id);
    const pages=Math.max(1,Math.ceil(records.length/fgPageSize));fgPage=Math.max(1,Math.min(fgPage,pages));
    $('#fgRows').innerHTML=records.slice((fgPage-1)*fgPageSize,fgPage*fgPageSize).map(record=>`<tr><td>${escape(record.model)}</td><td>${escape(record.version)}</td><td>${record.targets.map(target=>target.mode==='all'?`<div>${platformLabel(target.platform)}: 全部版本</div>`:target.ranges.map(range=>`<div>${platformLabel(target.platform)}: &gt;= ${escape(range.start)}${range.end?` &amp; &lt;= ${escape(range.end)}`:''}</div>`).join('')).join('')}</td><td>${record.mode==='force'?'强制升级':'非强制升级'}</td><td><div class="fx-status"><label class="switch"><input type="checkbox" data-fg-status="${record.id}" aria-label="固件配置 ${record.id} 状态" ${record.active?'checked':''}><span class="slider"></span></label><span>${record.active?'已生效':'已失效'}</span></div></td><td class="fx-description-preview">${escape(record.descriptions[activeSite==='cn'?'中文':'英语']||record.descriptions.中文||'—')}</td><td><button class="fx-text-button" data-fg-edit="${record.id}">编辑</button><button class="fx-text-button fx-danger" data-fg-delete="${record.id}">删除</button></td></tr>`).join('')||'<tr><td colspan="7" class="empty-state">暂无符合筛选条件的数据</td></tr>';
    const numbers=pages<=7?Array.from({length:pages},(_,i)=>i+1):[1,...(fgPage>3?['…']:[]),...Array.from({length:3},(_,i)=>fgPage+i-1).filter(n=>n>1&&n<pages),...(fgPage<pages-2?['…']:[]),pages];
    $('#fgPagination').innerHTML=`<span>共 ${records.length} 条</span><select id="fgPageSize" class="page-size" aria-label="固件每页条数">${[10,20,50].map(size=>`<option value="${size}" ${size===fgPageSize?'selected':''}>${size}条/页</option>`).join('')}</select><button class="page-btn" data-fg-page="${fgPage-1}" ${fgPage===1?'disabled':''}>‹</button>${numbers.map(n=>n==='…'?'<span class="page-ellipsis">…</span>':`<button class="page-btn ${n===fgPage?'active':''}" data-fg-page="${n}">${n}</button>`).join('')}<button class="page-btn" data-fg-page="${fgPage+1}" ${fgPage===pages?'disabled':''}>›</button><span>前往</span><input id="fgJump" class="page-jump" aria-label="固件跳转页码" value="${fgPage}" inputmode="numeric"><span>页</span>`;
  }
  function returnFirmwareList(){firmwareFormActive=false;draftEpoch++;$('#fgPage').hidden=true;showForceList();selectUpgradeTab('firmware');}
  function openFirmwareForm(id=null){
    const record=id===null?null:fgRecords.find(record=>record.id===id&&record.site===activeSite);if(id!==null&&!record)return;
    editId=null;fgEditId=id;firmwareFormActive=true;draftEpoch++;
    fgDraft=record?{model:record.model,version:record.version,mode:record.mode}:{model:'Gen1',version:'',mode:'normal'};
    fgDraft.audience=copy(record?.audience||{mode:'custom',ids:[],tails:'',ranges:[{start:'',end:''}],days:''});
    draftDescriptions=record?{...emptyDescriptions(),...record.descriptions}:emptyDescriptions();
    const group=newFirmwareGroup(record?.site||activeSite);
    if(record){group.platforms=record.targets.map(target=>target.platform);for(const target of record.targets)group.configs[`${target.platform}:${record.site}`]={mode:target.mode,ranges:copy(target.ranges.length?target.ranges:[newRange()])};}
    groups=[group];
    activateNavigation();$('#fxList').hidden=true;$('#fxCreate').hidden=true;$('#fxEdit').hidden=true;$('#fgPage').hidden=false;
    $('#fgTitle').textContent=id===null?'新增固件灰度配置':'编辑固件灰度配置';renderForm();window.scrollTo(0,0);
  }
  function renderFirmwareOptions(){ $('#fgVersionOptions').innerHTML=firmwareCatalog[fgDraft.model].filter(version=>version.startsWith(fgDraft.version)).map(version=>`<option value="${version}"></option>`).join(''); }
  function newFirmwareGroup(site=activeSite){return {uid:++groupSerial,site,platforms:['Android'],configs:{}};}
  function renderFirmwareGroup(group,index){
    return `<section class="fx-group" data-fx-group="${group.uid}"><div class="fx-group-head"><span>配置组 ${index+1}</span>${groups.length>1?'<button type="button" class="fx-text-button fx-danger" data-fx-remove-group>删除配置组</button>':''}</div>
      <div class="form-row"><label class="required">站点：</label><div class="control"><select class="fg-group-site" aria-label="配置站点" ${fgEditId!==null?'disabled':''}>${sites.map(site=>`<option value="${site.id}" ${site.id===group.site?'selected':''}>${site.name}</option>`).join('')}</select></div></div>
      <div class="form-row"><label class="required">平台：</label><div class="control fx-site-options">${platforms.map(platform=>`<label class="check"><input type="checkbox" data-fg-platform-choice value="${platform}" ${group.platforms.includes(platform)?'checked':''}>${platformLabel(platform)}</label>`).join('')}</div></div>
      ${group.platforms.map(platform=>`<div data-fg-platform="${platform}">${renderSite({...group,uid:`${group.uid}-${platform}`,platform},group.site).replace(`${siteLabel(group.site)}APP版本`,`${platformLabel(platform)} APP版本`).replaceAll('全部版本','全部APP版本').replaceAll('指定版本号','指定APP版本')}</div>`).join('')}</section>`;
  }
  let audiencePage=1,audiencePageSize=10,audienceQuery='';
  function renderAudience(){
    const a=fgDraft.audience;
    return `<div class="form-row"><label class="required">灰度人群：</label><div class="control"><div class="fg-audience-modes">${[['custom','自定义用户 ID'],['auto','系统自动圈选用户']].map(([value,label])=>`<label class="radio"><input type="radio" name="fgAudienceMode" value="${value}" ${a.mode===value?'checked':''}>${label}</label>`).join('')}</div><div class="fx-group fg-audience">${a.mode==='auto'?`<div class="form-row"><label class="required">活跃指标：</label><div class="control fg-inline">近 <input id="fgActiveDays" inputmode="numeric" value="${escape(a.days)}" aria-label="活跃天数"> 天活跃用户</div></div>`:`<div class="form-row"><label>指定用户 ID：</label><div class="control"><div class="fg-inline"><input id="fgIdEntry" placeholder="请输入用户 ID，多个 ID 用逗号分隔" inputmode="numeric"><button type="button" class="secondary" data-audience-add>添加</button></div><div id="fgIdTags"></div></div></div><div class="form-row"><label>用户 ID尾数：</label><div class="control"><input id="fgIdTails" value="${escape(a.tails)}" placeholder="如：1,2,3,4"><div class="mini-note">表示用户 ID最后一位数字。如：1,2,3,4</div></div></div><div class="form-row"><label>用户 ID 区间：</label><div class="control">${a.ranges.map((r,i)=>`<div class="fx-range"><div class="fx-bound"><span class="fx-bound-operator" aria-label="开始 ID 比较符号，固定大于等于">&gt;=</span><input data-audience-start="${i}" value="${escape(r.start)}" placeholder="开始 ID" inputmode="numeric"></div><span>—</span><div class="fx-bound"><span class="fx-bound-operator" aria-label="结束 ID 比较符号，固定小于等于">&lt;=</span><input data-audience-end="${i}" value="${escape(r.end)}" placeholder="结束 ID（可不填）" inputmode="numeric"></div>${a.ranges.length>1?`<button type="button" class="fx-text-button fx-danger" data-audience-range-remove="${i}">删除</button>`:''}<p class="fx-range-error" data-audience-error="${i}"></p></div>`).join('')}<button type="button" class="fx-text-button" data-audience-range-add>新增区间</button></div></div>`}</div></div></div>`;
  }
  function renderAudienceTags(){
    if(!$('#fgIdTags'))return;
    const ids=fgDraft.audience.ids;
    $('#fgIdTags').innerHTML=ids.slice(0,20).map(id=>`<span class="fg-user-tag">${escape(id)}<button type="button" data-audience-id-remove="${escape(id)}" aria-label="删除用户 ${escape(id)}">×</button></span>`).join('')+(ids.length>20?`<button type="button" class="fx-text-button" data-audience-more>显示更多（共 ${ids.length} 名用户）</button>`:'');
  }
  function addAudienceIds(){
    const input=$('#fgIdEntry'),values=input.value.trim().split(/[,，\s]+/).filter(Boolean);
    if(!values.length)return true;
    if(values.some(v=>!/^\d+$/.test(v))){error('用户 ID 只能输入整数',input);return false;}
    fgDraft.audience.ids=[...new Set([...fgDraft.audience.ids,...values.map(v=>BigInt(v).toString())])];input.value='';renderAudienceTags();return true;
  }
  function renderAudienceModal(){
    const ids=fgDraft.audience.ids.filter(id=>id.includes(audienceQuery)),pages=Math.max(1,Math.ceil(ids.length/audiencePageSize));
    audiencePage=Math.min(Math.max(1,audiencePage),pages);
    $('#fgAudienceRows').innerHTML=ids.slice((audiencePage-1)*audiencePageSize,audiencePage*audiencePageSize).map(id=>`<tr><td>${escape(id)}</td><td><button class="fx-text-button fx-danger" data-audience-id-remove="${escape(id)}">删除</button></td></tr>`).join('')||'<tr><td colspan="2" class="empty-state">暂无用户 ID</td></tr>';
    const availableWidth=$('#fgAudiencePagination').clientWidth||680;
    const nums=availableWidth<560?[audiencePage]:Array.from({length:pages},(_,i)=>i+1).filter(n=>n===1||n===pages||Math.abs(n-audiencePage)<=1);
    $('#fgAudiencePagination').innerHTML=`<span>共 ${ids.length} 条</span><select id="fgAudienceSize">${[10,20,50].map(n=>`<option ${n===audiencePageSize?'selected':''} value="${n}">${n}条/页</option>`).join('')}</select><button class="page-btn" data-audience-page="${audiencePage-1}" ${audiencePage===1?'disabled':''}>‹</button>${nums.map((n,i)=>`${i&&n>nums[i-1]+1?'<span>…</span>':''}<button class="page-btn ${n===audiencePage?'active':''}" data-audience-page="${n}">${n}</button>`).join('')}<button class="page-btn" data-audience-page="${audiencePage+1}" ${audiencePage===pages?'disabled':''}>›</button><span>前往</span><input class="page-jump" id="fgAudienceJump" value="${audiencePage}" inputmode="numeric"><span>页</span>`;
  }
  function initializeAudienceUI(){
    document.body.insertAdjacentHTML('beforeend','<div class="modal-backdrop fx-modal" id="fgAudienceModal" role="dialog" aria-modal="true" aria-labelledby="fgAudienceTitle" hidden><div class="modal fg-users-modal"><div class="modal-header"><strong id="fgAudienceTitle">用户 ID</strong></div><div class="fg-inline">用户 ID：<input id="fgAudienceSearch" placeholder="请输入用户 ID"><button class="secondary" id="fgAudienceSearchButton">查询</button></div><table class="fx-table"><thead><tr><th>用户 ID</th><th>操作</th></tr></thead><tbody id="fgAudienceRows"></tbody></table><div class="pagination" id="fgAudiencePagination"></div><div class="modal-footer"><button class="secondary" id="fgAudienceClose">关闭</button></div></div></div>');
    $('#fgAudienceClose').onclick=()=>closeModal('#fgAudienceModal');
    new ResizeObserver(()=>{if(!$('#fgAudienceModal').hidden)renderAudienceModal();}).observe($('#fgAudiencePagination'));
    $('#fgAudienceSearchButton').onclick=()=>{audienceQuery=$('#fgAudienceSearch').value.trim();audiencePage=1;renderAudienceModal();};
    $('#fgAudienceSearch').onkeydown=e=>{if(e.key==='Enter')$('#fgAudienceSearchButton').click();};
    $('#fgAudiencePagination').onchange=e=>{if(e.target.id==='fgAudienceSize'){audiencePageSize=Number(e.target.value);audiencePage=1;}if(e.target.id==='fgAudienceJump')audiencePage=Math.floor(Number(e.target.value))||1;renderAudienceModal();};
    $('#fgAudiencePagination').onkeydown=e=>{if(e.key==='Enter'&&e.target.id==='fgAudienceJump'){audiencePage=Math.floor(Number(e.target.value))||1;renderAudienceModal();}};
    document.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b||!firmwareFormActive)return;
      if(b.hasAttribute('data-audience-add'))addAudienceIds();
      if(b.hasAttribute('data-audience-id-remove')){fgDraft.audience.ids=fgDraft.audience.ids.filter(id=>id!==b.dataset.audienceIdRemove);renderAudienceTags();if(!$('#fgAudienceModal').hidden)renderAudienceModal();}
      if(b.hasAttribute('data-audience-more')){audiencePage=1;audienceQuery='';$('#fgAudienceSearch').value='';renderAudienceModal();showModal('#fgAudienceModal');}
      if(b.hasAttribute('data-audience-page')&&!b.disabled){audiencePage=Number(b.dataset.audiencePage);renderAudienceModal();}
      if(b.hasAttribute('data-audience-range-add')){fgDraft.audience.ranges.push({start:'',end:''});renderForm();}
      if(b.hasAttribute('data-audience-range-remove')&&fgDraft.audience.ranges.length>1){fgDraft.audience.ranges.splice(Number(b.dataset.audienceRangeRemove),1);renderForm();}
    });
    $('#fgForm').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='fgIdEntry'){e.preventDefault();addAudienceIds();}});
    $('#fgForm').addEventListener('change',e=>{if(e.target.name==='fgAudienceMode'){fgDraft.audience.mode=e.target.value;renderForm();}});
    $('#fgForm').addEventListener('input',e=>{
      const t=e.target,a=fgDraft.audience;
      if(t.id==='fgActiveDays'){t.value=t.value.replace(/\D/g,'').replace(/^0+/,'');a.days=t.value;}
      if(t.id==='fgIdTails')a.tails=t.value.trim();
      for(const bound of ['start','end'])if(t.hasAttribute(`data-audience-${bound}`)){
        t.value=t.value.replace(/\D/g,'');const i=Number(t.getAttribute(`data-audience-${bound}`)),r=a.ranges[i];r[bound]=t.value;
        $(`[data-audience-error="${i}"]`).textContent=r.start&&r.end&&BigInt(r.start)>BigInt(r.end)?'开始 ID 需要小于等于结束 ID':'';
      }
    });
  }
  function renderFirmwareForm(){
    $('#fgForm').innerHTML=`<p class="fx-error-summary" role="alert"></p><div class="form-row"><label class="required">固件版本：</label><div class="control"><select id="fgModel">${firmwareModels.map(model=>`<option ${model===fgDraft.model?'selected':''}>${model}</option>`).join('')}</select></div></div><div class="form-row"><label class="required">固件灰度版本：</label><div class="control"><input id="fgVersion" list="fgVersionOptions" value="${escape(fgDraft.version)}" placeholder="请输入并选择固件灰度版本" inputmode="decimal"><datalist id="fgVersionOptions"></datalist></div></div><div class="form-row fx-config-row"><label class="required">适配APP版本：</label><div class="control">${groups.map(renderFirmwareGroup).join('')}<button type="button" class="secondary" data-fx-add-group>＋ 新增配置组</button></div></div><div class="form-row"><label class="required">升级方式：</label><div class="control">${[['normal','非强制升级'],['force','强制升级']].map(([value,label])=>`<label class="radio"><input type="radio" name="fgUpgradeMode" value="${value}" ${fgDraft.mode===value?'checked':''}>${label}</label>`).join('')}</div></div>${renderAudience()}${renderDescriptions()}`;
    renderFirmwareOptions();renderAudienceTags();requestAnimationFrame(()=>$$('#fgForm .fx-description').forEach(resizeDescription));
  }
  function submitFirmware(){
    if($('#fgIdEntry')?.value.trim()&&!addAudienceIds())return;
    const audienceError=audienceIssue(fgDraft.audience);
    if(audienceError)return error(audienceError);
    const selectedSites=new Set();
    for(const group of groups){
      if(group.site&&selectedSites.has(group.site))return error('同一个站点存在多个配置');
      if(group.site)selectedSites.add(group.site);
    }
    if(!/^\d{2}\.\d{3}\.\d{3}$/.test(fgDraft.version)||!firmwareCatalog[fgDraft.model].includes(fgDraft.version))return error('请选择固件灰度版本',$('#fgVersion'));
    const combinations=new Set(),targetsBySite={};
    for(const group of groups){
      if(!group.site)return error('请选择站点');
      if(!group.platforms.length)return error('请选择平台');
      const site=group.site;
      for(const platform of group.platforms){
        if(combinations.has(platform))return error('同一平台只允许存在一条配置');combinations.add(platform);
        const config=configFor({...group,platform},site);
        if(config.mode==='specified'){
          for(const range of config.ranges){const issue=rangeIssue(range,true);if(issue)return error(issue);}
          if(overlappingIndex(config.ranges)>=0)return error('版本号区间重复');
        }
        (targetsBySite[site]||=[]).push({platform,mode:config.mode,ranges:config.mode==='all'?[]:copy(config.ranges)});
      }
    }
    const willBeActive=fgEditId===null||fgRecords.find(record=>record.id===fgEditId)?.active;
    for(const site of Object.keys(targetsBySite))if(willBeActive&&hasFirmwareConflict(fgRecords,site,fgDraft.model,fgEditId))return error(`${fgDraft.model}在${siteLabel(site)}已经存在配置，无需重复添加。`);
    if(fgEditId!==null){const record=fgRecords.find(record=>record.id===fgEditId);if(!record)return error('配置不存在，请刷新列表');Object.assign(record,copy(fgDraft),{targets:targetsBySite[record.site],descriptions:copy(draftDescriptions)});}
    else {let id=Math.max(0,...fgRecords.map(record=>record.id));for(const [site,targets] of Object.entries(targetsBySite))fgRecords.push({id:++id,site,...copy(fgDraft),targets,descriptions:copy(draftDescriptions),active:true});}
    if(!targetsBySite[activeSite]){activeSite=Object.keys(targetsBySite)[0];$('#fxSite').value=activeSite;}
    saveFirmware();fgPage=1;returnFirmwareList();toast('成功');
  }
  initializeFirmwareUI();
  initializeAudienceUI();
  ['#fxCreateForm','#fxEditForm','#fgForm'].forEach(selector => {
    const root = $(selector);
    root.addEventListener('input', event => {
      if (event.target.id === 'fxDescriptionKey') descriptionKey = event.target.value;
      if (event.target.matches('.fx-description')) {
        draftDescriptions[event.target.dataset.fxLanguage] = event.target.value;
        resizeDescription(event.target);
      }
      if (event.target.matches('input[data-fx-bound]')) updateBound(event.target, false);
      $('.fx-error-summary', root).textContent = '';
    });
    root.addEventListener('change', async event => {
      if (event.target.name === 'fxDescriptionEnabled') {
        descriptionEnabled = event.target.value === 'yes'; renderForm(); return;
      }
      if (event.target.matches('.fx-description-upload')) {
        const input = event.target, file = input.files[0], epoch = draftEpoch;
        if (!file) return;
        if (!/\.xlsx$/i.test(file.name)) { toast('请上传 .xlsx 格式文件'); input.value = ''; return; }
        if (file.size > 5 * 1024 * 1024) { toast('上传文件不能超过 5M'); input.value = ''; return; }
        input.disabled = true;
        try {
          const translations = await readTranslationXlsx(file);
          if (epoch !== draftEpoch || !root.getClientRects().length) return;
          for (const language of langs) if (Object.hasOwn(translations.normal, language)) draftDescriptions[language] = translations.normal[language];
          renderForm();
        } catch {
          if (epoch === draftEpoch && root.getClientRects().length) toast('上传翻译文件解析失败');
        } finally { input.disabled = false; input.value = ''; }
        return;
      }
      const element = event.target, { group, config } = formContext(element);
      if (element.matches('.fx-platform') && editId === null) { group.platform = element.value; renderForm(); }
      if (element.dataset.fxSiteChoice && editId === null) {
        group.sites = sites.filter(site => site.id === element.dataset.fxSiteChoice ? element.checked : group.sites.includes(site.id)).map(site => site.id); renderForm();
      }
      if (element.dataset.fxMode) { config.mode = element.dataset.fxMode; renderForm(); }
      if (element.dataset.fxBound) updateBound(element, true);
    });
    root.addEventListener('click', event => {
      const element = event.target.closest('button'); if (!element) return;
      const { group, config, rangeIndex } = formContext(element);
      if (element.hasAttribute('data-fx-add-group') && editId === null) { groups.push(firmwareFormActive?newFirmwareGroup():newGroup()); renderForm(); }
      if (element.hasAttribute('data-fx-remove-group') && editId === null && groups.length > (firmwareFormActive ? 1 : 2)) { groups = groups.filter(item => item !== group); renderForm(); }
      if (element.hasAttribute('data-fx-add-range')) { config.ranges.push(newRange()); renderForm(); }
      if (element.hasAttribute('data-fx-remove-range') && config.ranges.length > 1) { config.ranges.splice(rangeIndex,1); renderForm(); }
    });
  });
  $('#fxRows').onclick = event => {
    const element = event.target.closest('button'); if (!element) return;
    if (element.dataset.fxEdit) edit(Number(element.dataset.fxEdit));
    if (element.dataset.fxDelete) { deleteId = Number(element.dataset.fxDelete); showModal('#fxDeleteModal'); }
  };
  $('#fxRows').onchange = event => {
    const id = Number(event.target.dataset.fxStatus);
    const record = database.records.find(item => item.id === id && item.site === activeSite);
    if (!record) return;
    if (event.target.checked && hasActiveConflict(database.records, record.site, record.platform, record.id)) {
      event.target.checked = record.active;
      toast(`${platformLabel(record.platform)}在${siteLabel(record.site)}已经存在配置，无法设置为生效。`);
      return;
    }
    record.active = event.target.checked; record.updated = timeString(); record.operator = '当前用户'; save(); renderList(); toast(record.active ? '配置已生效' : '配置已失效');
  };
  $('#fxDeleteConfirm').onclick = () => {
    database.records = database.records.filter(record => record.id !== deleteId); save(); deleteId = null;
    closeModal('#fxDeleteModal'); renderList(); toast('配置已删除');
  };
  $('#fxDeleteCancel').onclick = () => { deleteId = null; closeModal('#fxDeleteModal'); };
  ['#fxEditCancel','#fxEditBack'].forEach(selector => $(selector).onclick = showForceList);
  ['#fxCreateCancel','#fxCreateBack'].forEach(selector => $(selector).onclick = showForceList);
  $('#fxAdd').onclick = create;
  $('#fxCreateSubmit').onclick = submit; $('#fxEditSubmit').onclick = submit;
  $('#fxPagination').onclick = event => {
    const button = event.target.closest('[data-fx-page]'); if (!button || button.disabled) return;
    page = Number(button.dataset.fxPage); renderList();
  };
  $('#fxPagination').onchange = event => {
    if (event.target.id === 'fxPageSize') { perPage = Number(event.target.value); page = 1; renderList(); }
    if (event.target.id === 'fxPageJump') { page = Math.floor(Number(event.target.value)) || 1; renderList(); }
  };
  $('#fxPagination').onkeydown = event => { if (event.key === 'Enter' && event.target.id === 'fxPageJump') { page = Math.floor(Number(event.target.value)) || 1; renderList(); } };
  document.addEventListener('keydown', event => {
    const modal = $$('.fx-modal').find(item => !item.hidden); if (!modal) return;
    if (event.key === 'Escape') { closeModal(`#${modal.id}`); editId = null; deleteId = null; }
    if (event.key === 'Tab') {
      const focusable = $$('button,input,select,textarea', modal).filter(item => !item.disabled && item.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  function openUpgradeRoute() {
    if (location.hash === '#force-update' || location.hash === '#version-upgrade' || location.hash.startsWith('#version-upgrade/')) {
      const firmwareTab = location.hash === '#version-upgrade/firmware-gray';
      showForceList(); if (firmwareTab) selectUpgradeTab('firmware');
    }
  }
  window.addEventListener('hashchange', openUpgradeRoute);
  openUpgradeRoute();
})();
