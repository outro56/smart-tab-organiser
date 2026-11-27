// Options page script

document.addEventListener('DOMContentLoaded', async () => {
  const navigation = document.querySelectorAll('.settings-nav a');
  const views = document.querySelectorAll('[data-settings-view]');
  const actionStatus = document.getElementById('actionStatus');
  const actionMenu = document.querySelector('.action-menu');
  const actionMenuSummary = actionMenu.querySelector('summary');

  document.addEventListener('click', event => {
    if (!actionMenu.open) return;
    if (!actionMenu.contains(event.target)) {
      actionMenu.open = false;
    } else if (event.target.closest('button')) {
      actionMenu.open = false;
      actionMenuSummary.focus();
    }
  });
  actionMenu.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !actionMenu.open) return;
    actionMenu.open = false;
    actionMenuSummary.focus();
  });

  function showSettingsView() {
    const target = document.getElementById(window.location.hash.slice(1));
    const activeView = target?.closest('[data-settings-view]') || views[0];
    actionMenu.open = false;
    views.forEach(view => { view.hidden = view !== activeView; });
    navigation.forEach(link => {
      if (link.hash === `#${activeView.id}`) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    actionStatus.textContent = '';
    if (target && target !== activeView && activeView.contains(target)) {
      const details = target.closest('details');
      if (details) details.open = true;
      target.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
  }
  window.addEventListener('hashchange', showSettingsView);
  showSettingsView();
  const ignoreQueryCheckbox = document.getElementById('ignoreQuery');
  const closeDuplicateTabsCheckbox = document.getElementById('closeDuplicateTabs');
  const ignoreHashCheckbox = document.getElementById('ignoreHash');
  const reloadTabsCheckbox = document.getElementById('reloadTabs');
  const testBtn = document.getElementById('testBtn');
  const reloadAllBtn = document.getElementById('reloadAllBtn');
  const openaiKeyInput = document.getElementById('openaiKey');
  const claudeKeyInput = document.getElementById('claudeKey');
  const geminiKeyInput = document.getElementById('geminiKey');
  const aiProviderSelect = document.getElementById('aiProvider');
  const aiFallbackEnabledCheckbox = document.getElementById('aiFallbackEnabled');
  const aiFallbackHintEl = document.getElementById('aiFallbackHint');
  const openaiModelSelect = document.getElementById('openaiModel');
  const claudeModelSelect = document.getElementById('claudeModel');
  const geminiModelSelect = document.getElementById('geminiModel');
  const openaiModelRecommendedEl = document.getElementById('openaiModelRecommended');
  const claudeModelRecommendedEl = document.getElementById('claudeModelRecommended');
  const geminiModelRecommendedEl = document.getElementById('geminiModelRecommended');
  const localBaseUrlInput = document.getElementById('localBaseUrl');
  const localModelInput = document.getElementById('localModel');
  const testLocalModelBtn = document.getElementById('testLocalModelBtn');
  const localModelStatus = document.getElementById('localModelStatus');
  const customOpenaiBaseUrlInput = document.getElementById('customOpenaiBaseUrl');
  const customOpenaiKeyInput = document.getElementById('customOpenaiKey');
  const customOpenaiModelInput = document.getElementById('customOpenaiModel');
  const testCustomOpenaiBtn = document.getElementById('testCustomOpenaiBtn');
  const customOpenaiStatus = document.getElementById('customOpenaiStatus');
  const customOpenaiModelsList = document.getElementById('customOpenaiModels');
  const checkChromeAiBtn = document.getElementById('checkChromeAiBtn');
  const downloadChromeAiBtn = document.getElementById('downloadChromeAiBtn');
  const chromeAiStatus = document.getElementById('chromeAiStatus');
  const aiAllowCloudFallbackCheckbox = document.getElementById('aiAllowCloudFallback');
  const cloudFallbackRow = document.getElementById('cloudFallbackRow');
  const fallbackOrderItem = document.getElementById('fallbackOrderItem');
  const fallbackOrderList = document.getElementById('fallbackOrderList');
  const selectedProvider = document.getElementById('selectedProvider');
  const otherProviders = document.getElementById('otherProviders');
  const otherProviderSelect = document.getElementById('otherProviderSelect');
  const providerCards = document.querySelectorAll('.provider-card[data-provider]');
  const isFirefox = window.location.protocol === 'moz-extension:';
  const providerLabels = new Map(Array.from(aiProviderSelect.options, option => [option.value, option.textContent]));
  const checkedModels = new Map();
  const providerModelInputs = {
    openai: openaiModelSelect, claude: claudeModelSelect, gemini: geminiModelSelect,
    'custom-openai': customOpenaiModelInput,
  };
  let chromeAiAvailable = false;
  const MODEL_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

  function localModelSettings() {
    return globalThis.resolveLocalModelSettings({
      localBaseUrl: localBaseUrlInput.value, localModel: localModelInput.value,
    }, isFirefox);
  }

  function renderProviderChecks() {
    for (const option of [...aiProviderSelect.options, ...otherProviderSelect.options]) {
      const provider = option.value;
      if (!provider) continue;
      const model = provider === 'local' ? localModelSettings().model : providerModelInputs[provider]?.value.trim();
      const verified = provider === 'chrome-ai' ? chromeAiAvailable : checkedModels.get(provider)?.has(model);
      option.textContent = `${verified ? '✅ ' : ''}${providerLabels.get(provider)}`;
    }
  }

  function setCheckedModels(provider, models) {
    checkedModels.set(provider, new Set(models));
    renderProviderChecks();
  }

  function recentlyChecked(updatedAt) {
    const age = Date.now() - updatedAt;
    return age >= 0 && age < MODEL_CACHE_MAX_AGE;
  }

  async function connectionFingerprint(value) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function trackServerModels(provider, connection) {
    const cacheKey = `${provider}ConnectionCheck`;
    let revision = 0;
    return {
      invalidate() {
        revision++;
        setCheckedModels(provider, []);
      },
      async restore() {
        const startedAt = revision;
        try {
          const [fingerprint, stored] = await Promise.all([
            connectionFingerprint(connection()), chrome.storage.local.get(cacheKey),
          ]);
          const cache = stored[cacheKey];
          if (startedAt === revision && cache?.fingerprint === fingerprint && recentlyChecked(cache.updatedAt)) {
            setCheckedModels(provider, cache.models);
          }
        } catch (error) {
          // A live check can still confirm the provider if storage is unavailable.
        }
      },
      async record(models) {
        const startedAt = ++revision;
        setCheckedModels(provider, models);
        try {
          const fingerprint = await connectionFingerprint(connection());
          if (startedAt === revision) {
            await chrome.storage.local.set({ [cacheKey]: { fingerprint, models, updatedAt: Date.now() } });
          }
        } catch (error) {
          // The live result still applies to this settings page.
        }
      },
    };
  }

  function updateModelRecommendedHint(provider, hintEl, selectEl) {
    if (!hintEl || !selectEl) return;
    const recommendedId = globalThis.getRecommendedModelId(provider);
    const recommended = globalThis.findModelEntry(provider, recommendedId);
    hintEl.textContent = selectEl.value === recommendedId
      ? recommended?.description || ''
      : `Recommended: ${recommended?.label || recommendedId}`;
  }

  function wireModelSelect(selectEl, provider, hintEl, storageKey) {
    selectEl.addEventListener('change', () => {
      chrome.storage.local.set({ [storageKey]: selectEl.value });
      updateModelRecommendedHint(provider, hintEl, selectEl);
      renderProviderChecks();
    });
  }

  wireModelSelect(openaiModelSelect, 'openai', openaiModelRecommendedEl, 'openaiModel');
  wireModelSelect(claudeModelSelect, 'claude', claudeModelRecommendedEl, 'claudeModel');
  wireModelSelect(geminiModelSelect, 'gemini', geminiModelRecommendedEl, 'geminiModel');

  const cloudModelControls = [
    { provider: 'openai', input: openaiKeyInput, select: openaiModelSelect, hint: openaiModelRecommendedEl },
    { provider: 'claude', input: claudeKeyInput, select: claudeModelSelect, hint: claudeModelRecommendedEl },
    { provider: 'gemini', input: geminiKeyInput, select: geminiModelSelect, hint: geminiModelRecommendedEl },
  ];
  async function refreshCloudModelList(control, force = false) {
    const generation = control.generation = (control.generation || 0) + 1;
    const key = control.input.value.trim();
    const isCurrent = () => control.generation === generation && control.input.value.trim() === key;
    control.button.disabled = true;
    control.status.textContent = key ? 'Checking model list…' : 'Add an API key to discover models.';
    let previousCatalog;
    const cacheKey = `${control.provider}ModelCatalog`;
    try {
      if (!key) return;
      // Bind cached availability to the credential without storing a second copy of the key.
      const fingerprint = await connectionFingerprint(key);
      const stored = await chrome.storage.local.get(cacheKey);
      const cache = stored[cacheKey];
      const usable = cache && cache.fingerprint === fingerprint &&
        Array.isArray(cache.models) && cache.models.length && Number.isFinite(cache.updatedAt);
      const render = models => {
        globalThis.setDiscoveredModels(control.provider, models);
        globalThis.populateModelSelect(control.select, control.provider, control.select.value);
        updateModelRecommendedHint(control.provider, control.hint, control.select);
      };
      if (!isCurrent()) return;
      if (usable) {
        previousCatalog = cache;
        render(cache.models);
        if (!force && recentlyChecked(cache.updatedAt)) {
          setCheckedModels(control.provider, cache.models.map(model => model.id));
          control.status.textContent = `Cached model list. Last checked: ${new Date(cache.updatedAt).toLocaleString()}.`;
          return;
        }
      }
      const models = await globalThis.fetchCloudModels(control.provider, key);
      if (!isCurrent()) return;
      const updatedAt = Date.now();
      await chrome.storage.local.set({ [cacheKey]: { fingerprint, models, updatedAt } });
      if (!isCurrent()) return;
      render(models);
      setCheckedModels(control.provider, models.map(model => model.id));
      control.status.textContent = `Model list updated: ${new Date(updatedAt).toLocaleString()}.`;
    } catch (error) {
      if (!isCurrent()) return;
      setCheckedModels(control.provider, []);
      if (previousCatalog && recentlyChecked(previousCatalog.updatedAt)) {
        // Keep the saved choices but require a fresh check before showing the badge again.
        chrome.storage.local.set({ [cacheKey]: { ...previousCatalog, updatedAt: 0 } }).catch(() => {});
      }
      control.status.textContent = 'Could not refresh models. The saved or bundled list is still available. Check the API key and try again.';
    } finally {
      if (isCurrent()) control.button.disabled = false;
    }
  }

  for (const control of cloudModelControls) {
    control.button = document.createElement('button');
    control.button.type = 'button';
    control.button.className = 'btn btn-secondary';
    control.button.textContent = 'Refresh models';
    control.button.addEventListener('click', () => refreshCloudModelList(control, true));
    control.status = document.createElement('p');
    control.status.className = 'model-recommended-hint';
    control.status.setAttribute('role', 'status');
    control.hint.after(control.button, control.status);
    control.input.addEventListener('input', () => {
      control.generation = (control.generation || 0) + 1;
      setCheckedModels(control.provider, []);
      control.button.disabled = false;
      globalThis.setDiscoveredModels(control.provider, []);
      globalThis.populateModelSelect(control.select, control.provider, control.select.value);
      control.status.textContent = 'API key changed. Select Refresh models to update the list.';
    });
    control.input.addEventListener('change', () => refreshCloudModelList(control));
  }
  const customInstructionsOptions = document.getElementById('customInstructionsOptions');
  const preserveGroupsCheckbox = document.getElementById('preserveGroups');
  const preserveGroupsMinTabsInput = document.getElementById('preserveGroupsMinTabs');
  const preserveGroupsMinTabsRow = document.getElementById('preserveGroupsMinTabsRow');
  const preserveGroupsMinTabsWarning = document.getElementById('preserveGroupsMinTabsWarning');
  const mergeIntoExistingCheckbox = document.getElementById('mergeIntoExisting');
  const refineExistingGroupsCheckbox = document.getElementById('refineExistingGroups');
  const uniqueGroupNamesCheckbox = document.getElementById('uniqueGroupNames');
  const excludedDomainsInput = document.getElementById('excludedDomains');
  const sortTabsWithinGroupsByTitleCheckbox = document.getElementById('sortTabsWithinGroupsByTitle');
  const organizeOnClickCheckbox = document.getElementById('organizeOnClick');
  const autoOrganizeEnabledCheckbox = document.getElementById('autoOrganizeEnabled');
  const autoOrganizeDelayInput = document.getElementById('autoOrganizeDelay');
  const autoOrganizeDelayRow = document.getElementById('autoOrganizeDelayRow');
  const organizeTabsBtn = document.getElementById('organizeTabsBtn');
  const tidyPinnedBtn = document.getElementById('tidyPinnedBtn');
  const ungroupTabsBtn = document.getElementById('ungroupTabsBtn');
  const pinnedUrlsTextarea = document.getElementById('pinnedUrls');
  const refreshPrGroupBtn = document.getElementById('refreshPrGroupBtn');
  const testReviewConnectionBtn = document.getElementById('testReviewConnectionBtn');
  const refreshClosedIssueGroupBtn = document.getElementById('refreshClosedIssueGroupBtn');
  const refreshGithubLabelGroupsBtn = document.getElementById('refreshGithubLabelGroupsBtn');
  const githubTokenInput = document.getElementById('githubToken');
  const prProviderSelect = document.getElementById('prProvider');
  const prProviderFields = document.querySelectorAll('[data-review-provider]');
  const prProviderInputs = ['gitlabToken', 'azureDevOpsToken', 'azureDevOpsOrganization', 'azureDevOpsProject']
    .map(id => document.getElementById(id));
  const reviewInputs = [githubTokenInput, ...prProviderInputs];
  const reviewOptions = Array.from(prProviderSelect.options, option => ({
    option, label: option.textContent, provider: ReviewProviders.getProvider(option.value),
  }));
  const reviewCheckKeys = reviewOptions.map(({ provider }) => ReviewProviders.checkKey(provider));
  const prGroupEnabledCheckbox = document.getElementById('prGroupEnabled');
  const prGroupColorSelect = document.getElementById('prGroupColor');
  const closedIssueGroupEnabledCheckbox = document.getElementById('closedIssueGroupEnabled');
  const githubLabelGroupsEnabledCheckbox = document.getElementById('githubLabelGroupsEnabled');
  const githubLabelGroupsOnClickCheckbox = document.getElementById('githubLabelGroupsOnClick');
  const githubLabelGroupsOnClickRow = document.getElementById('githubLabelGroupsOnClickRow');
  const githubLabelGroupNamesTextarea = document.getElementById('githubLabelGroupNames');
  const githubLabelGroupNamesWarning = document.getElementById('githubLabelGroupNamesWarning');
  const githubLabelGroupColorsContainer = document.getElementById('githubLabelGroupColors');
  const bookmarksGroupColorSelect = document.getElementById('bookmarksGroupColor');

  const RESERVED_GITHUB_LABEL_GROUP_NAMES = new Map([
    ['prs', 'PRs'],
    ['closed', 'Closed'],
    ['bookmarks', 'BOOKMARKS'],
    ['misc', 'Misc'],
  ]);
  const CHROME_TAB_GROUP_COLORS = new Set([
    'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'
  ]);
  const GITHUB_LABEL_DEFAULT_COLOR_ORDER = [
    'red', 'green', 'purple', 'cyan', 'orange', 'pink', 'yellow', 'blue', 'grey'
  ];
  let githubLabelGroupColors = {};
  let githubLabelGroupColorsWrite = Promise.resolve();

  function normalizeGitHubLabelGroupName(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  function normalizeChromeTabGroupColor(value) {
    if (typeof value !== 'string') return null;
    const color = value.trim().toLowerCase();
    return CHROME_TAB_GROUP_COLORS.has(color) ? color : null;
  }

  function normalizeGitHubLabelGroupNames(value) {
    const lines = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(/\r?\n/)
        : [];
    const names = [];
    const seen = new Set();

    for (const line of lines) {
      if (typeof line !== 'string') continue;
      const name = line.trim();
      if (!name) continue;
      const key = normalizeGitHubLabelGroupName(name);
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }

    return names;
  }

  function updateGitHubLabelGroupNamesWarning(names) {
    const reservedNames = names
      .map(name => RESERVED_GITHUB_LABEL_GROUP_NAMES.get(normalizeGitHubLabelGroupName(name)))
      .filter(Boolean);

    githubLabelGroupNamesWarning.hidden = reservedNames.length === 0;
    githubLabelGroupNamesWarning.textContent = reservedNames.length
      ? `The extension ignores these reserved names: ${reservedNames.join(', ')}.`
      : '';
  }

  function getRenderableGitHubLabelGroupNames(names) {
    return names.filter(name => !RESERVED_GITHUB_LABEL_GROUP_NAMES.has(normalizeGitHubLabelGroupName(name)));
  }

  function normalizeGitHubLabelGroupColors(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

    const entries = [];
    const seen = new Set();
    for (const [rawName, rawColor] of Object.entries(value)) {
      const name = normalizeGitHubLabelGroupName(rawName);
      const color = normalizeChromeTabGroupColor(rawColor);
      if (!name || !color || seen.has(name) || RESERVED_GITHUB_LABEL_GROUP_NAMES.has(name)) continue;
      seen.add(name);
      entries.push([name, color]);
    }
    return Object.fromEntries(entries);
  }

  function updateGitHubLabelGroupsOnClickState() {
    const enabled = githubLabelGroupsEnabledCheckbox.checked;
    githubLabelGroupsOnClickCheckbox.disabled = !enabled;
    githubLabelGroupsOnClickRow.classList.toggle('setting-item--disabled', !enabled);
    githubLabelGroupsOnClickRow.setAttribute('aria-disabled', String(!enabled));
  }

  function getReservedGitHubLabelGroupColors() {
    return new Set([
      'grey',
      normalizeChromeTabGroupColor(bookmarksGroupColorSelect.value) || 'yellow',
      normalizeChromeTabGroupColor(prGroupColorSelect.value) || 'blue',
    ]);
  }

  function ensureGitHubLabelGroupColors(names) {
    const renderableNames = getRenderableGitHubLabelGroupNames(names);
    const savedColors = new Map(Object.entries(normalizeGitHubLabelGroupColors(githubLabelGroupColors)));
    const colors = new Map();
    const reservedColors = getReservedGitHubLabelGroupColors();
    const defaultColors = GITHUB_LABEL_DEFAULT_COLOR_ORDER.filter(color => !reservedColors.has(color));
    const usedColors = new Set(reservedColors);

    for (const name of renderableNames) {
      const key = normalizeGitHubLabelGroupName(name);
      const color = normalizeChromeTabGroupColor(savedColors.get(key));
      if (!color) continue;
      colors.set(key, color);
      usedColors.add(color);
    }

    for (const [index, name] of renderableNames.entries()) {
      const key = normalizeGitHubLabelGroupName(name);
      if (colors.has(key)) continue;

      const color = defaultColors.find(candidate => !usedColors.has(candidate))
        || defaultColors[index % defaultColors.length];
      colors.set(key, color);
      usedColors.add(color);
    }

    githubLabelGroupColors = Object.fromEntries(colors);
    return renderableNames;
  }

  function persistGitHubLabelGroupColors() {
    const colors = Object.fromEntries(Object.entries(githubLabelGroupColors));
    githubLabelGroupColorsWrite = githubLabelGroupColorsWrite
      .catch(() => {})
      .then(() => chrome.storage.local.set({ githubLabelGroupColors: colors }));
    return githubLabelGroupColorsWrite;
  }

  function renderGitHubLabelGroupColorSelectors(names) {
    githubLabelGroupColorsContainer.textContent = '';

    names.forEach((name, index) => {
      const key = normalizeGitHubLabelGroupName(name);
      const selectId = `githubLabelGroupColor-${index}`;
      const row = document.createElement('div');
      row.className = 'github-label-group-color-row';

      const label = document.createElement('label');
      label.className = 'github-label-group-color-label';
      label.htmlFor = selectId;

      const position = document.createElement('span');
      position.className = 'github-label-group-color-position';
      position.textContent = `${index + 1}.`;

      const labelName = document.createElement('span');
      labelName.className = 'github-label-group-color-name';
      labelName.textContent = name;
      label.append(position, labelName);

      const select = document.createElement('select');
      select.id = selectId;
      select.className = 'provider-select github-label-group-color-select';
      for (const color of GITHUB_LABEL_DEFAULT_COLOR_ORDER) {
        const option = document.createElement('option');
        option.value = color;
        option.textContent = color.charAt(0).toUpperCase() + color.slice(1);
        select.append(option);
      }
      select.value = githubLabelGroupColors[key];
      select.addEventListener('change', () => {
        const colors = new Map(Object.entries(githubLabelGroupColors));
        colors.set(key, select.value);
        githubLabelGroupColors = Object.fromEntries(colors);
        syncGitHubLabelGroupColors(normalizeGitHubLabelGroupNames(githubLabelGroupNamesTextarea.value));
      });

      row.append(label, select);
      githubLabelGroupColorsContainer.append(row);
    });
  }

  function syncGitHubLabelGroupColors(names) {
    const renderableNames = ensureGitHubLabelGroupColors(names);
    renderGitHubLabelGroupColorSelectors(renderableNames);
    return persistGitHubLabelGroupColors();
  }

  function saveGitHubLabelGroupNames(updateTextarea = false) {
    const names = normalizeGitHubLabelGroupNames(githubLabelGroupNamesTextarea.value);
    if (updateTextarea) {
      githubLabelGroupNamesTextarea.value = names.join('\n');
    }
    updateGitHubLabelGroupNamesWarning(names);
    return Promise.all([
      chrome.storage.local.set({ githubLabelGroupNames: names }),
      syncGitHubLabelGroupColors(names),
    ]);
  }

  function hasNormalizedGitHubLabelGroupNames(value, names) {
    return Array.isArray(value)
      && value.length === names.length
      && value.every((name, index) => name === names[index]);
  }

  // Show/hide password for API key inputs
  document.querySelectorAll('.toggle-password').forEach((btn) => {
    btn.addEventListener('click', () => {
      const wrapper = btn.closest('.input-with-toggle');
      const input = wrapper && wrapper.querySelector('input[type="password"], input[type="text"]');
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.classList.toggle('revealed', isPassword);
      const currentLabel = btn.getAttribute('aria-label') || ' key';
      const suffix = currentLabel.startsWith('Show ') ? currentLabel.slice(5) : currentLabel.startsWith('Hide ') ? currentLabel.slice(5) : 'key';
      const newLabel = isPassword ? `Hide ${suffix}` : `Show ${suffix}`;
      btn.setAttribute('aria-label', newLabel);
      btn.setAttribute('title', newLabel);
    });
  });

  // Load saved settings
  const settings = await chrome.storage.local.get([
    'closeDuplicateTabs', 'ignoreQuery', 'ignoreHash', 'reloadTabs',
    'openaiKey', 'claudeKey', 'geminiKey', 'aiProvider', 'aiFallbackEnabled', 'aiAllowCloudFallback',
    'openaiModel', 'claudeModel', 'geminiModel', 'customInstructionsOptions',
    'preserveGroups', 'preserveGroupsMinTabs', 'mergeIntoExisting', 'refineExistingGroups', 'uniqueGroupNames',
    'excludedDomains', 'sortTabsWithinGroupsByTitle', 'organizeOnClick', 'pinnedUrls',
    'autoOrganizeEnabled', 'autoOrganizeDelay',
    'githubToken', 'prProvider', ...prProviderInputs.map(input => input.id),
    'prGroupEnabled', 'prGroupColor', 'closedIssueGroupEnabled',
    'githubLabelGroupsEnabled', 'githubLabelGroupsOnClick', 'githubLabelGroupNames', 'githubLabelGroupColors',
    'bookmarksGroupColor', 'localBaseUrl', 'localModel',
    'customOpenaiBaseUrl', 'customOpenaiKey', 'customOpenaiModel'
  ]);
  ignoreQueryCheckbox.checked = settings.ignoreQuery !== false; // default to true
  closeDuplicateTabsCheckbox.checked = settings.closeDuplicateTabs !== false;
  ignoreHashCheckbox.checked = settings.ignoreHash !== false; // default to true
  reloadTabsCheckbox.checked = settings.reloadTabs === true;
  
  // Load AI settings
  if (settings.openaiKey) {
    openaiKeyInput.value = settings.openaiKey;
  }
  if (settings.claudeKey) {
    claudeKeyInput.value = settings.claudeKey;
  }
  if (settings.geminiKey) {
    geminiKeyInput.value = settings.geminiKey;
  }
  if (isFirefox) {
    aiProviderSelect.querySelector('option[value="chrome-ai"]').remove();
    document.querySelector('.provider-card[data-provider="chrome-ai"]').remove();
  }
  const preferredProvider = settings.aiProvider || (isFirefox ? 'local' : 'openai');
  aiProviderSelect.value = isFirefox && preferredProvider === 'chrome-ai' ? 'local' : preferredProvider;
  aiFallbackEnabledCheckbox.checked = settings.aiFallbackEnabled === true; // explicit opt-in
  aiAllowCloudFallbackCheckbox.checked = settings.aiAllowCloudFallback === true; // default off — explicit opt-in
  const openaiResolved = globalThis.populateModelSelect(openaiModelSelect, 'openai', settings.openaiModel);
  const claudeResolved = globalThis.populateModelSelect(claudeModelSelect, 'claude', settings.claudeModel);
  const geminiResolved = globalThis.populateModelSelect(geminiModelSelect, 'gemini', settings.geminiModel);
  localBaseUrlInput.value = settings.localBaseUrl || '';
  localModelInput.value = settings.localModel || '';
  localBaseUrlInput.placeholder = globalThis.resolveLocalModelSettings({}, isFirefox).baseUrl;
  updateLocalModelPlaceholder();
  customOpenaiBaseUrlInput.value = settings.customOpenaiBaseUrl || '';
  customOpenaiKeyInput.value = settings.customOpenaiKey || '';
  customOpenaiModelInput.value = settings.customOpenaiModel || '';
  updateModelRecommendedHint('openai', openaiModelRecommendedEl, openaiModelSelect);
  updateModelRecommendedHint('claude', claudeModelRecommendedEl, claudeModelSelect);
  updateModelRecommendedHint('gemini', geminiModelRecommendedEl, geminiModelSelect);
  if (
    openaiResolved !== settings.openaiModel ||
    claudeResolved !== settings.claudeModel ||
    geminiResolved !== settings.geminiModel
  ) {
    chrome.storage.local.set({
      openaiModel: openaiResolved,
      claudeModel: claudeResolved,
      geminiModel: geminiResolved,
    });
  }
  for (const control of cloudModelControls) refreshCloudModelList(control);
  if (settings.customInstructionsOptions) {
    customInstructionsOptions.value = settings.customInstructionsOptions;
  }
  preserveGroupsCheckbox.checked = settings.preserveGroups !== false; // default to true
  refineExistingGroupsCheckbox.checked = settings.refineExistingGroups === true;
  uniqueGroupNamesCheckbox.checked = settings.uniqueGroupNames !== false;
  excludedDomainsInput.value = typeof settings.excludedDomains === 'string' ? settings.excludedDomains : '';
  const savedMinTabs = settings.preserveGroupsMinTabs;
  preserveGroupsMinTabsInput.value = savedMinTabs !== undefined && savedMinTabs !== '' ? Number(savedMinTabs) : 1;
  updatePreserveGroupsMinTabsVisibility();
  updatePreserveGroupsMinTabsWarning();
  mergeIntoExistingCheckbox.checked = settings.mergeIntoExisting === true;
  sortTabsWithinGroupsByTitleCheckbox.checked = settings.sortTabsWithinGroupsByTitle === true;
  organizeOnClickCheckbox.checked = settings.organizeOnClick === true;
  autoOrganizeEnabledCheckbox.checked = settings.autoOrganizeEnabled === true;
  autoOrganizeDelayRow.hidden = !autoOrganizeEnabledCheckbox.checked;
  autoOrganizeDelayInput.value = settings.autoOrganizeDelay !== undefined ? Number(settings.autoOrganizeDelay) : 5;
  if (Array.isArray(settings.pinnedUrls)) {
    pinnedUrlsTextarea.value = settings.pinnedUrls.join('\n');
  }
  if (settings.githubToken) {
    githubTokenInput.value = settings.githubToken;
  }
  prProviderSelect.value = globalThis.ReviewProviders.getProvider(settings.prProvider).id;
  for (const input of prProviderInputs) input.value = settings[input.id] || '';
  updatePrProviderFields();
  prGroupEnabledCheckbox.checked = settings.prGroupEnabled === true;
  prGroupColorSelect.value = normalizeChromeTabGroupColor(settings.prGroupColor) || 'blue';
  closedIssueGroupEnabledCheckbox.checked = settings.closedIssueGroupEnabled === true;
  githubLabelGroupsEnabledCheckbox.checked = settings.githubLabelGroupsEnabled === true;
  githubLabelGroupsOnClickCheckbox.checked = settings.githubLabelGroupsOnClick !== false;
  updateGitHubLabelGroupsOnClickState();
  bookmarksGroupColorSelect.value = normalizeChromeTabGroupColor(settings.bookmarksGroupColor) || 'yellow';
  const loadedGitHubLabelGroupNames = normalizeGitHubLabelGroupNames(settings.githubLabelGroupNames);
  githubLabelGroupNamesTextarea.value = loadedGitHubLabelGroupNames.join('\n');
  updateGitHubLabelGroupNamesWarning(loadedGitHubLabelGroupNames);
  if (
    settings.githubLabelGroupNames !== undefined
    && !hasNormalizedGitHubLabelGroupNames(settings.githubLabelGroupNames, loadedGitHubLabelGroupNames)
  ) {
    chrome.storage.local.set({ githubLabelGroupNames: loadedGitHubLabelGroupNames });
  }
  githubLabelGroupColors = normalizeGitHubLabelGroupColors(settings.githubLabelGroupColors);
  await syncGitHubLabelGroupColors(loadedGitHubLabelGroupNames);

  // Save settings when changed
  closeDuplicateTabsCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ closeDuplicateTabs: closeDuplicateTabsCheckbox.checked });
  });

  ignoreQueryCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ ignoreQuery: ignoreQueryCheckbox.checked });
    chrome.runtime.sendMessage({ action: 'updateBadge' });
  });
  
  ignoreHashCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ ignoreHash: ignoreHashCheckbox.checked });
    chrome.runtime.sendMessage({ action: 'updateBadge' });
  });
  
  reloadTabsCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ reloadTabs: reloadTabsCheckbox.checked });
  });
  
  // Save AI settings
  openaiKeyInput.addEventListener('input', () => {
    chrome.storage.local.set({ openaiKey: openaiKeyInput.value.trim() });
  });

  claudeKeyInput.addEventListener('input', () => {
    chrome.storage.local.set({ claudeKey: claudeKeyInput.value.trim() });
  });

  geminiKeyInput.addEventListener('input', () => {
    chrome.storage.local.set({ geminiKey: geminiKeyInput.value.trim() });
  });

  customOpenaiKeyInput.addEventListener('input', () => {
    chrome.storage.local.set({ customOpenaiKey: customOpenaiKeyInput.value.trim() });
  });

  const PROVIDER_LABELS_OPTIONS = {
    openai: 'OpenAI',
    claude: 'Claude',
    gemini: 'Gemini',
    'chrome-ai': 'Chrome built-in AI',
    local: 'Local model server',
    'custom-openai': 'OpenAI Compatible API Host'
  };
  const LOCAL_PROVIDERS_OPTIONS = ['chrome-ai', 'local'];

  function normalizeCustomBaseUrlForPermission(rawUrl) {
    let url = (rawUrl || '').trim();
    if (!url) return null;
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    return parsed;
  }

  /** Ask Chrome for one origin, reporting a rejected match pattern as a normal error. */
  async function requestOriginPermissionOptions(originPattern) {
    let granted;
    try {
      granted = await chrome.permissions.request({ origins: [originPattern] });
    } catch (error) {
      throw new Error(`Chrome refused host access for ${originPattern}: ${error.message || error}`);
    }
    if (!granted) {
      throw new Error(`Permission for ${originPattern} was not granted.`);
    }
  }

  /** Request one origin unless it is loopback, which the manifest already permits. */
  async function requestOriginPermissionIfMissing(parsed) {
    if (HostAccess.isStaticallyAllowedUrl(parsed)) return;
    const originPattern = HostAccess.originPattern(parsed);
    const hasPermission = await chrome.permissions.contains({ origins: [originPattern] });
    if (hasPermission) return;
    await requestOriginPermissionOptions(originPattern);
  }

  async function requestCustomHostPermissionIfNeeded(rawBaseUrl) {
    const parsed = normalizeCustomBaseUrlForPermission(rawBaseUrl);
    if (!parsed) throw new Error('Enter a valid OpenAI-compatible base URL.');
    if (parsed.protocol !== 'https:' && !HostAccess.allowsPlainHttpUrl(parsed)) {
      throw new Error(
        'Remote OpenAI-compatible hosts must use HTTPS. ' + HostAccess.ALLOWED_HTTP_HOSTS_HINT
      );
    }
    await requestOriginPermissionIfMissing(parsed);
  }

  /**
   * The local model provider only talks to this computer or the local network.
   * Loopback needs no permission; a server on the LAN needs one, and this click
   * is a user gesture, so the options page can ask for it. Organization from the
   * toolbar asks for the same origin itself.
   */
  async function requestLocalHostPermissionIfNeeded(rawBaseUrl) {
    let url = (rawBaseUrl || '').trim();
    if (!url) return; // Empty means the default loopback server.
    if (!/^https?:\/\//i.test(url)) {
      url = `http://${url}`;
    }
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error('Enter a valid local model server address.');
    }
    if (!HostAccess.allowsLocalProviderUrl(parsed)) {
      throw new Error(
        'The local model provider only reaches this computer or your local network. '
        + HostAccess.ALLOWED_HTTP_HOSTS_HINT
      );
    }
    await requestOriginPermissionIfMissing(parsed);
  }

  // Row tags for each status describeProviderChain can report.
  const ORDER_TAG_TEXT = {
    primary: 'Primary — always first',
    ready: 'Ready',
    'no-key': 'No API key',
    'missing-base-url': 'No base URL',
    'missing-model-name': 'No model name',
    'invalid-base-url': 'Invalid base URL',
    'insecure-http-url': 'Remote HTTP blocked',
    'missing-host-permission': 'Needs host permission',
    'not-downloaded': 'Model not downloaded',
    'no-model-name': 'No model name',
    'blocked-host': 'Unsupported address',
    'cloud-opt-in-off': 'Needs cloud fallback opt-in',
    'not-after-cloud': 'Not used after a cloud primary',
    disabled: ''
  };

  function showProviderCards() {
    providerCards.forEach(card => {
      if (!card.isConnected) return;
      const isPrimary = card.dataset.provider === aiProviderSelect.value;
      card.hidden = !isPrimary && card.dataset.provider !== otherProviderSelect.value;
      card.classList.toggle('provider-card--active', isPrimary);
      const container = isPrimary ? selectedProvider : otherProviders;
      if (card.parentElement !== container) container.append(card);
    });
  }

  function updateActiveProviderCard() {
    const previous = otherProviderSelect.value;
    const alternatives = Array.from(aiProviderSelect.options)
      .filter(option => option.value !== aiProviderSelect.value)
      .map(option => option.cloneNode(true));
    otherProviderSelect.replaceChildren(new Option('Choose a provider', ''), ...alternatives);
    if (alternatives.some(option => option.value === previous)) otherProviderSelect.value = previous;
    renderProviderChecks();
    showProviderCards();
  }

  otherProviderSelect.addEventListener('change', showProviderCards);

  // The cloud opt-in only applies to a local primary, and the order list
  // only means something with fallback on at all.
  function updateFallbackControlsVisibility() {
    const primary = aiProviderSelect.value || 'openai';
    const fallbackOn = aiFallbackEnabledCheckbox.checked;
    cloudFallbackRow.style.display = fallbackOn && LOCAL_PROVIDERS_OPTIONS.includes(primary) ? '' : 'none';
    fallbackOrderItem.style.display = fallbackOn ? '' : 'none';
  }

  async function moveFallbackProvider(order, index, delta) {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await chrome.storage.local.set({ aiFallbackOrder: next });
    refreshFallbackUi();
  }

  function renderFallbackOrder(desc) {
    fallbackOrderList.textContent = '';
    const statusByProvider = new Map(desc.entries.map((e) => [e.provider, e.status]));
    desc.order.forEach((provider, index) => {
      const status = statusByProvider.get(provider) || 'disabled';
      const inChain = status === 'primary' || status === 'ready';

      const row = document.createElement('li');
      row.className = 'fallback-order-row' + (inChain ? '' : ' fallback-order-row--inactive');

      const pos = document.createElement('span');
      pos.className = 'order-pos';
      pos.textContent = String(index + 1);

      const name = document.createElement('span');
      name.className = 'order-name';
      name.textContent = PROVIDER_LABELS_OPTIONS[provider] || provider;

      const tag = document.createElement('span');
      tag.className = 'order-tag'
        + (status === 'primary' ? ' order-tag--primary' : '')
        + (status === 'ready' ? ' order-tag--ready' : '');
      tag.textContent = ORDER_TAG_TEXT[status] || '';

      const btns = document.createElement('span');
      btns.className = 'order-btns';
      const makeArrow = (delta, glyph, direction) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'order-btn';
        btn.textContent = glyph;
        btn.title = `Move ${PROVIDER_LABELS_OPTIONS[provider] || provider} ${direction}`;
        btn.setAttribute('aria-label', btn.title);
        btn.disabled = delta < 0 ? index === 0 : index === desc.order.length - 1;
        btn.addEventListener('click', () => moveFallbackProvider(desc.order, index, delta));
        return btn;
      };
      btns.append(makeArrow(-1, '▲', 'up'), makeArrow(1, '▼', 'down'));

      row.append(pos, name, tag, btns);
      fallbackOrderList.append(row);
    });
  }

  function renderFallbackHint(desc) {
    if (!aiFallbackHintEl) return;
    const label = (p) => PROVIDER_LABELS_OPTIONS[p] || p;

    if (!desc.fallbackEnabled) {
      aiFallbackHintEl.textContent = `Fallback disabled — only ${label(desc.primary)} will be used.`;
      return;
    }

    const parts = [
      desc.chain.length > 1
        ? `Fallback order: ${desc.chain.map(label).join(' → ')}.`
        : `No fallback available — only ${label(desc.primary)} will be used.`
    ];

    const statusByProvider = new Map(desc.entries.map((e) => [e.provider, e.status]));
    if (desc.localPrimary) {
      if (statusByProvider.get('local') === 'no-model-name') {
        parts.push('Set a local model name to enable the local fallback.');
      }
      if (statusByProvider.get('local') === 'blocked-host') {
        parts.push('The local model server must be on this computer or your local network.');
      }
      if (statusByProvider.get('chrome-ai') === 'not-downloaded') {
        parts.push('Chrome built-in AI joins the chain once its model is downloaded.');
      }
      if (aiAllowCloudFallbackCheckbox.checked) {
        parts.push(desc.chain.some((p) => !LOCAL_PROVIDERS_OPTIONS.includes(p))
          ? 'If a cloud fallback runs, tab titles and URLs are sent to that provider.'
          : 'Cloud fallback is allowed, but no cloud provider is fully configured yet.');
      } else {
        parts.push('Cloud providers will never be used.');
      }
    } else if (desc.chain.length > 1) {
      parts.push('Cloud primaries never fall back to local providers.');
    } else {
      const customStatus = statusByProvider.get('custom-openai');
      if (customStatus === 'missing-base-url') {
        parts.push('Set the OpenAI Compatible base URL to make it eligible for fallback.');
      } else if (customStatus === 'missing-model-name') {
        parts.push('Set the OpenAI Compatible model name to make it eligible for fallback.');
      } else if (customStatus === 'invalid-base-url') {
        parts.push('Fix the OpenAI Compatible base URL so the extension can use it.');
      } else if (customStatus === 'insecure-http-url') {
        parts.push('Remote OpenAI Compatible hosts must use HTTPS. ' + HostAccess.ALLOWED_HTTP_HOSTS_HINT);
      } else if (customStatus === 'missing-host-permission') {
        parts.push('OpenAI Compatible host access is not granted yet. Click Fetch models for that host first.');
      } else {
        parts.push('Add an OpenAI, Claude, or Gemini API key above to enable automatic fallback.');
      }
    }
    aiFallbackHintEl.textContent = parts.join(' ');
  }

  // One source of truth: the service worker computes the chain exactly as organizing
  // will run it (buildProviderChain), and the order list + hint render from that.
  async function refreshFallbackUi() {
    try {
      const desc = await chrome.runtime.sendMessage({ action: 'describeProviderChain' });
      if (!desc || !desc.success) return;
      renderFallbackOrder(desc);
      renderFallbackHint(desc);
    } catch (error) {
      // Service worker unreachable — keep the current render.
    }
  }

  // Key inputs save on every keystroke; coalesce the recomputes.
  let fallbackUiTimer = null;
  function scheduleFallbackUiRefresh() {
    clearTimeout(fallbackUiTimer);
    fallbackUiTimer = setTimeout(refreshFallbackUi, 200);
  }

  function refreshProviderUi() {
    updateActiveProviderCard();
    updateFallbackControlsVisibility();
    scheduleFallbackUiRefresh();
  }

  aiProviderSelect.addEventListener('change', async () => {
    await chrome.storage.local.set({ aiProvider: aiProviderSelect.value });
    refreshProviderUi();
    if (aiProviderSelect.value === 'chrome-ai') {
      checkChromeAi();
    }
    if (aiProviderSelect.value === 'local') localModelPicker.refresh(false);
  });

  aiFallbackEnabledCheckbox.addEventListener('change', async () => {
    await chrome.storage.local.set({ aiFallbackEnabled: aiFallbackEnabledCheckbox.checked });
    refreshProviderUi();
  });

  aiAllowCloudFallbackCheckbox.addEventListener('change', async () => {
    await chrome.storage.local.set({ aiAllowCloudFallback: aiAllowCloudFallbackCheckbox.checked });
    scheduleFallbackUiRefresh();
  });

  // Refresh when an API key changes (fallback eligibility depends on which keys are present)
  [openaiKeyInput, claudeKeyInput, geminiKeyInput, customOpenaiKeyInput].forEach((input) => {
    input.addEventListener('input', scheduleFallbackUiRefresh);
  });
  refreshProviderUi();

  function updateLocalModelPlaceholder() {
    const { model } = globalThis.resolveLocalModelSettings({ localBaseUrl: localBaseUrlInput.value }, isFirefox);
    localModelInput.placeholder = model ? `Default: ${model}` : 'Select or enter a model name';
  }

  const localServerCheck = trackServerModels('local', () => localModelSettings().baseUrl);
  const customServerCheck = trackServerModels('custom-openai', () => JSON.stringify([
    customOpenaiBaseUrlInput.value.trim(), customOpenaiKeyInput.value.trim(),
  ]));
  let customConnectionRevision = 0;
  for (const field of [customOpenaiBaseUrlInput, customOpenaiKeyInput]) {
    field.addEventListener('input', () => {
      customConnectionRevision++;
      customServerCheck.invalidate();
      customOpenaiModelsList.replaceChildren();
      customOpenaiStatus.textContent = '';
    });
  }

  localBaseUrlInput.addEventListener('input', () => {
    localServerCheck.invalidate();
    updateLocalModelPlaceholder();
    chrome.storage.local.set({ localBaseUrl: localBaseUrlInput.value.trim() });
    scheduleFallbackUiRefresh(); // the chain shows this host's access state
  });

  localModelInput.addEventListener('input', () => {
    chrome.storage.local.set({ localModel: localModelInput.value.trim() });
    renderProviderChecks();
    scheduleFallbackUiRefresh(); // the local fallback chain depends on a model name being set
  });

  customOpenaiBaseUrlInput.addEventListener('input', () => {
    chrome.storage.local.set({ customOpenaiBaseUrl: customOpenaiBaseUrlInput.value.trim() });
    scheduleFallbackUiRefresh();
  });

  customOpenaiModelInput.addEventListener('input', () => {
    chrome.storage.local.set({ customOpenaiModel: customOpenaiModelInput.value.trim() });
    renderProviderChecks();
    scheduleFallbackUiRefresh();
  });

  const localModelPicker = globalThis.createLocalModelPicker({
    document,
    chrome,
    elements: {
      address: localBaseUrlInput,
      model: localModelInput,
      choices: document.getElementById('localModelChoices'),
      refresh: testLocalModelBtn,
      status: localModelStatus,
      suggestion: document.getElementById('localModelSuggestion'),
      source: document.getElementById('localModelSource'),
      setup: document.getElementById('localModelSetup'),
      shell: document.getElementById('localSetupShell'),
      serveCommand: document.getElementById('localServeCommand'),
      pullCommand: document.getElementById('localPullCommand'),
      macCommand: document.getElementById('localMacCommand'),
    },
    requestPermission: requestLocalHostPermissionIfNeeded,
    onSelect: model => {
      chrome.storage.local.set({ localModel: model });
      renderProviderChecks();
      scheduleFallbackUiRefresh();
    },
    onModelsChecked: localServerCheck.record,
    onRefresh: scheduleFallbackUiRefresh,
  });
  localServerCheck.restore();
  customServerCheck.restore();
  if (aiProviderSelect.value === 'local') localModelPicker.refresh(false);

  // Ask the service worker to test the OpenAI-compatible host, so the result
  // reflects the context that actually organizes tabs.
  testCustomOpenaiBtn.addEventListener('click', async () => {
    const revision = customConnectionRevision;
    const isCurrent = () => customConnectionRevision === revision;
    const baseUrl = customOpenaiBaseUrlInput.value.trim();
    const apiKey = customOpenaiKeyInput.value.trim();
    testCustomOpenaiBtn.disabled = true;
    customOpenaiStatus.textContent = 'Testing connection...';
    customOpenaiStatus.className = 'status info';
    try {
      await requestCustomHostPermissionIfNeeded(baseUrl);
      if (!isCurrent()) return;
      const result = await chrome.runtime.sendMessage({
        action: 'testCustomOpenAI', baseUrl, apiKey,
      });
      if (!isCurrent()) return;
      customServerCheck.record(result?.success ? result.models : []);
      if (!result) {
        customOpenaiStatus.textContent =
          'No response from the service worker. Reload the extension (chrome://extensions → refresh) and try again.';
        customOpenaiStatus.className = 'status error';
        return;
      }
      if (!result.success) {
        customOpenaiStatus.textContent = result.error || 'Could not reach the OpenAI-compatible host';
        customOpenaiStatus.className = 'status error';
        return;
      }
      if (result.models.length === 0) {
        customOpenaiStatus.textContent = `Connected to ${result.baseUrl}, but no models were listed.`;
        customOpenaiStatus.className = 'status error';
        return;
      }
      // Populate the model dropdown (combobox) with the upstream catalog.
      customOpenaiModelsList.textContent = '';
      for (const model of result.models) {
        const option = document.createElement('option');
        option.value = model;
        customOpenaiModelsList.append(option);
      }
      const chosen = customOpenaiModelInput.value.trim();
      const known = result.models.includes(chosen);
      const preview = result.models.slice(0, 8).join(', ');
      const more = result.models.length > 8 ? ` … and ${result.models.length - 8} more` : '';
      customOpenaiStatus.textContent =
        `Connected to ${result.baseUrl}. ${result.models.length} models available (${preview}${more}).` +
        (chosen && !known ? ` Warning: "${chosen}" is not in that list.` : '');
      customOpenaiStatus.className = chosen && !known ? 'status info' : 'status success';
    } catch (error) {
      if (!isCurrent()) return;
      customServerCheck.record([]);
      customOpenaiStatus.textContent = 'Error: ' + error.message;
      customOpenaiStatus.className = 'status error';
    } finally {
      testCustomOpenaiBtn.disabled = false;
      scheduleFallbackUiRefresh();
    }
  });

  // silent: refresh the download button and fallback UI without touching the status box.
  async function checkChromeAi({ silent = false } = {}) {
    checkChromeAiBtn.disabled = true;
    if (!silent) {
      chromeAiStatus.textContent = 'Checking on-device model...';
      chromeAiStatus.className = 'status info';
    }
    try {
      const result = await chrome.runtime.sendMessage({ action: 'checkChromeAI' });
      chromeAiAvailable = result?.success && result.state === 'available';
      renderProviderChecks();
      if (!result.success) {
        if (!silent) {
          chromeAiStatus.textContent = result.error || 'Could not check Chrome built-in AI';
          chromeAiStatus.className = 'status error';
        }
        return;
      }
      downloadChromeAiBtn.hidden = !(result.available && result.state !== 'available');
      if (!silent) {
        chromeAiStatus.textContent = result.message;
        chromeAiStatus.className = result.available
          ? (result.state === 'available' ? 'status success' : 'status info')
          : 'status error';
      }
    } catch (error) {
      chromeAiAvailable = false;
      renderProviderChecks();
      if (!silent) {
        chromeAiStatus.textContent = 'Error: ' + error.message;
        chromeAiStatus.className = 'status error';
      }
    } finally {
      checkChromeAiBtn.disabled = false;
      scheduleFallbackUiRefresh(); // Nano availability affects the fallback chain
    }
  }

  checkChromeAiBtn.addEventListener('click', checkChromeAi);

  // Chrome can require a user gesture to start the first model download, which the
  // service worker never has — so start it here, from a real click.
  downloadChromeAiBtn.addEventListener('click', async () => {
    if (typeof LanguageModel === 'undefined') {
      chromeAiStatus.textContent = 'Chrome built-in AI is not available in this browser.';
      chromeAiStatus.className = 'status error';
      return;
    }
    downloadChromeAiBtn.disabled = true;
    chromeAiStatus.textContent = 'Starting download... this can take several minutes. Keep this page open.';
    chromeAiStatus.className = 'status info';
    try {
      const session = await LanguageModel.create({
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            chromeAiStatus.textContent = `Downloading Gemini Nano: ${Math.round((e.loaded || 0) * 100)}%`;
          });
        }
      });
      session.destroy();
      chromeAiAvailable = true;
      renderProviderChecks();
      chromeAiStatus.textContent = 'Gemini Nano is downloaded and ready to use on this device.';
      chromeAiStatus.className = 'status success';
      downloadChromeAiBtn.hidden = true;
      scheduleFallbackUiRefresh(); // Nano can now join fallback chains
    } catch (error) {
      chromeAiStatus.textContent = 'Download failed: ' + error.message;
      chromeAiStatus.className = 'status error';
    } finally {
      downloadChromeAiBtn.disabled = false;
    }
  });

  // Check availability up front: loudly (status box) when Chrome AI is the primary,
  // silently otherwise — the fallback hint needs the state either way.
  if (!isFirefox) checkChromeAi({ silent: aiProviderSelect.value !== 'chrome-ai' });

  customInstructionsOptions.addEventListener('input', () => {
    chrome.storage.local.set({ customInstructionsOptions: customInstructionsOptions.value.trim() });
  });
  
  excludedDomainsInput.addEventListener('input', () => {
    chrome.storage.local.set({ excludedDomains: excludedDomainsInput.value });
  });

  // Refine mode replaces preserve/merge; the minimum size still applies to new groups.
  function updatePreserveGroupsMinTabsVisibility() {
    const refine = refineExistingGroupsCheckbox.checked;
    preserveGroupsCheckbox.disabled = refine;
    mergeIntoExistingCheckbox.disabled = refine;
    document.getElementById('preserveGroupsRefineNote').style.display = refine ? '' : 'none';
    document.getElementById('mergeIntoExistingRefineNote').style.display = refine ? '' : 'none';
    const visible = preserveGroupsCheckbox.checked || refine;
    preserveGroupsMinTabsRow.style.display = visible ? '' : 'none';
    preserveGroupsMinTabsInput.disabled = !visible;
  }

  refineExistingGroupsCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ refineExistingGroups: refineExistingGroupsCheckbox.checked });
    updatePreserveGroupsMinTabsVisibility();
  });

  uniqueGroupNamesCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ uniqueGroupNames: uniqueGroupNamesCheckbox.checked });
  });

  function updatePreserveGroupsMinTabsWarning() {
    const n = parseInt(preserveGroupsMinTabsInput.value, 10);
    preserveGroupsMinTabsWarning.style.display = (!isNaN(n) && n > 3) ? '' : 'none';
  }

  preserveGroupsCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ preserveGroups: preserveGroupsCheckbox.checked });
    updatePreserveGroupsMinTabsVisibility();
  });

  preserveGroupsMinTabsInput.addEventListener('input', () => {
    const raw = preserveGroupsMinTabsInput.value.trim();
    const n = raw === '' ? 1 : Math.max(0, parseInt(raw, 10));
    if (!isNaN(n)) {
      chrome.storage.local.set({ preserveGroupsMinTabs: n });
      preserveGroupsMinTabsInput.value = n;
    }
    updatePreserveGroupsMinTabsWarning();
  });

  preserveGroupsMinTabsInput.addEventListener('change', () => {
    const parsed = parseInt(preserveGroupsMinTabsInput.value, 10);
    const n = Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
    preserveGroupsMinTabsInput.value = n;
    chrome.storage.local.set({ preserveGroupsMinTabs: n });
    updatePreserveGroupsMinTabsWarning();
  });
  
  mergeIntoExistingCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ mergeIntoExisting: mergeIntoExistingCheckbox.checked });
  });

  sortTabsWithinGroupsByTitleCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ sortTabsWithinGroupsByTitle: sortTabsWithinGroupsByTitleCheckbox.checked });
  });
  
  organizeOnClickCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ organizeOnClick: organizeOnClickCheckbox.checked });
  });

  autoOrganizeEnabledCheckbox.addEventListener('change', () => {
    autoOrganizeDelayRow.hidden = !autoOrganizeEnabledCheckbox.checked;
    chrome.storage.local.set({ autoOrganizeEnabled: autoOrganizeEnabledCheckbox.checked });
  });

  autoOrganizeDelayInput.addEventListener('input', () => {
    const value = Number(autoOrganizeDelayInput.value);
    if (value >= 1 && value <= 60) {
      chrome.storage.local.set({ autoOrganizeDelay: value });
    }
  });

  pinnedUrlsTextarea.addEventListener('input', () => {
    const lines = pinnedUrlsTextarea.value.split('\n').map(s => s.trim()).filter(Boolean);
    chrome.storage.local.set({ pinnedUrls: lines });
  });

  bookmarksGroupColorSelect.addEventListener('change', () => {
    const color = normalizeChromeTabGroupColor(bookmarksGroupColorSelect.value) || 'yellow';
    bookmarksGroupColorSelect.value = color;
    chrome.storage.local.set({ bookmarksGroupColor: color });
    syncGitHubLabelGroupColors(normalizeGitHubLabelGroupNames(githubLabelGroupNamesTextarea.value));
  });

  let reviewChecksRevision = 0;
  async function renderReviewChecks() {
    const revision = ++reviewChecksRevision;
    const settings = Object.fromEntries(reviewInputs.map(input => [input.id, input.value]));
    try {
      const checks = await chrome.storage.local.get(reviewCheckKeys);
      const labels = await Promise.all(reviewOptions.map(async ({ provider, label }) => {
        const check = checks[ReviewProviders.checkKey(provider)];
        if (!check || !recentlyChecked(check.updatedAt)) return label;
        if (check.fingerprint !== await ReviewProviders.connectionFingerprint(provider, settings)) return label;
        if (provider.permission && !await chrome.permissions.contains({ origins: [provider.permission] })) return label;
        return `✅ ${label}`;
      }));
      if (revision === reviewChecksRevision) {
        reviewOptions.forEach(({ option }, index) => { option.textContent = labels[index]; });
      }
    } catch (error) {
      if (revision === reviewChecksRevision) reviewOptions.forEach(({ option, label }) => { option.textContent = label; });
    }
  }

  function updatePrProviderFields() {
    for (const field of prProviderFields) field.hidden = field.dataset.reviewProvider !== prProviderSelect.value;
  }
  prProviderSelect.addEventListener('change', () => {
    chrome.storage.local.set({ prProvider: prProviderSelect.value });
    updatePrProviderFields();
  });
  for (const input of reviewInputs) {
    input.addEventListener('input', () => {
      chrome.storage.local.set({ [input.id]: input.value.trim() });
      const entry = reviewOptions.find(({ provider }) => provider.fields.includes(input.id));
      entry.option.textContent = entry.label;
      renderReviewChecks();
    });
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && reviewCheckKeys.some(key => Object.hasOwn(changes, key))) renderReviewChecks();
  });
  chrome.permissions.onRemoved.addListener(renderReviewChecks);
  renderReviewChecks();
  prGroupEnabledCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ prGroupEnabled: prGroupEnabledCheckbox.checked });
  });
  prGroupColorSelect.addEventListener('change', () => {
    const color = normalizeChromeTabGroupColor(prGroupColorSelect.value) || 'blue';
    prGroupColorSelect.value = color;
    chrome.storage.local.set({ prGroupColor: color });
    syncGitHubLabelGroupColors(normalizeGitHubLabelGroupNames(githubLabelGroupNamesTextarea.value));
  });
  githubLabelGroupsEnabledCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ githubLabelGroupsEnabled: githubLabelGroupsEnabledCheckbox.checked });
    updateGitHubLabelGroupsOnClickState();
  });
  githubLabelGroupsOnClickCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ githubLabelGroupsOnClick: githubLabelGroupsOnClickCheckbox.checked });
  });
  githubLabelGroupNamesTextarea.addEventListener('input', () => {
    saveGitHubLabelGroupNames();
  });
  githubLabelGroupNamesTextarea.addEventListener('change', () => {
    saveGitHubLabelGroupNames(true);
  });
  closedIssueGroupEnabledCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ closedIssueGroupEnabled: closedIssueGroupEnabledCheckbox.checked });
  });

  async function runReviewAction(testOnly) {
    testReviewConnectionBtn.disabled = true;
    refreshPrGroupBtn.disabled = true;
    actionStatus.textContent = testOnly ? 'Checking review provider…' : 'Refreshing PR group…';
    actionStatus.className = 'status info';
    try {
      const provider = globalThis.ReviewProviders.getProvider(prProviderSelect.value);
      if (provider.permission && !await chrome.permissions.request({ origins: [provider.permission] })) {
        throw new Error('Access to ' + provider.name + ' was declined.');
      }
      if (!testOnly) {
        const prGroupColor = normalizeChromeTabGroupColor(prGroupColorSelect.value) || 'blue';
        await chrome.storage.local.set({ prGroupColor });
      }
      const result = await chrome.runtime.sendMessage({
        action: testOnly ? 'testReviewConnection' : 'syncPrTabGroup', provider: provider.id,
      });
      if (result.success) {
        actionStatus.textContent = result.message || 'PR group refreshed.';
        actionStatus.className = 'status success';
      } else {
        actionStatus.textContent = result.error || (testOnly ? 'Could not connect to the review provider.' : 'Failed to refresh PR group.');
        actionStatus.className = 'status error';
      }
    } catch (error) {
      actionStatus.textContent = 'Error: ' + error.message;
      actionStatus.className = 'status error';
    } finally {
      testReviewConnectionBtn.disabled = false;
      refreshPrGroupBtn.disabled = false;
    }
  }
  testReviewConnectionBtn.addEventListener('click', () => runReviewAction(true));
  refreshPrGroupBtn.addEventListener('click', () => runReviewAction(false));

  refreshClosedIssueGroupBtn.addEventListener('click', async () => {
    refreshClosedIssueGroupBtn.disabled = true;
    actionStatus.textContent = 'Checking GitHub issue tabs...';
    actionStatus.className = 'status info';
    try {
      const result = await chrome.runtime.sendMessage({ action: 'syncClosedIssueTabGroup' });
      if (result.success) {
        actionStatus.textContent = result.message || 'Closed group refreshed.';
        actionStatus.className = result.warning ? 'status info' : 'status success';
      } else {
        actionStatus.textContent = result.error || 'Failed to refresh Closed group';
        actionStatus.className = 'status error';
      }
    } catch (error) {
      actionStatus.textContent = 'Error: ' + error.message;
      actionStatus.className = 'status error';
    } finally {
      refreshClosedIssueGroupBtn.disabled = false;
    }
  });

  refreshGithubLabelGroupsBtn.addEventListener('click', async () => {
    refreshGithubLabelGroupsBtn.disabled = true;
    actionStatus.textContent = 'Deduplicating tabs and refreshing label groups...';
    actionStatus.className = 'status info';
    try {
      await saveGitHubLabelGroupNames(true);
      const result = await chrome.runtime.sendMessage({ action: 'syncGitHubLabelTabGroups' });
      if (result && result.success) {
        const messages = [result.message, result.warning]
          .filter(message => typeof message === 'string' && message.trim());
        actionStatus.textContent = messages.join('\n') || 'The extension refreshed the label groups.';
        actionStatus.className = result.warning ? 'status info' : 'status success';
      } else {
        const messages = result
          ? [result.error, result.warning, result.message]
            .filter(message => typeof message === 'string' && message.trim())
          : [];
        actionStatus.textContent = messages.join('\n') || 'The extension did not refresh the label groups.';
        actionStatus.className = 'status error';
      }
    } catch (error) {
      actionStatus.textContent = 'Error: ' + error.message;
      actionStatus.className = 'status error';
    } finally {
      refreshGithubLabelGroupsBtn.disabled = false;
    }
  });

  // Test duplicate detection
  testBtn.addEventListener('click', async () => {
    testBtn.disabled = true;
    actionStatus.textContent = 'Checking for duplicates...';
    actionStatus.className = 'status info';

    try {
      // Get duplicate count
      const result = await chrome.runtime.sendMessage({ action: 'getDuplicateCount' });
      
      if (result.success) {
        if (result.count > 0) {
          actionStatus.textContent = `Found ${result.count} duplicate tab(s) that would be closed.`;
          actionStatus.className = 'status info';
        } else {
          actionStatus.textContent = 'No duplicate tabs found.';
          actionStatus.className = 'status success';
        }
      } else {
        actionStatus.textContent = result.error || 'An error occurred';
        actionStatus.className = 'status error';
      }
    } catch (error) {
      actionStatus.textContent = 'Error: ' + error.message;
      actionStatus.className = 'status error';
    } finally {
      testBtn.disabled = false;
    }
  });

  // Reload all tabs
  reloadAllBtn.addEventListener('click', async () => {
    reloadAllBtn.disabled = true;
    actionStatus.textContent = 'Reloading tabs...';
    actionStatus.className = 'status info';

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'reloadAllTabs'
      });

      if (result.success) {
        actionStatus.textContent = `Reloaded ${result.reloadedCount} tab(s).`;
        actionStatus.className = 'status success';
      } else {
        actionStatus.textContent = result.error || 'An error occurred';
        actionStatus.className = 'status error';
      }
    } catch (error) {
      actionStatus.textContent = 'Error: ' + error.message;
      actionStatus.className = 'status error';
    } finally {
      reloadAllBtn.disabled = false;
    }
  });

  // Organize tabs button
  organizeTabsBtn.addEventListener('click', async () => {
    organizeTabsBtn.disabled = true;
    actionStatus.textContent = 'Deduplicating and organizing tabs with AI...';
    actionStatus.className = 'status info';

    try {
      const preserveGroups = preserveGroupsCheckbox.checked;
      const minTabsParsed = parseInt(preserveGroupsMinTabsInput.value, 10);
      const preserveGroupsMinTabs = Number.isFinite(minTabsParsed) && minTabsParsed >= 0 ? minTabsParsed : 1;
      const mergeIntoExisting = mergeIntoExistingCheckbox.checked;
      const customInstructions = customInstructionsOptions.value.trim();

      // This click owns the gesture, so grant every host the run may need before
      // the service worker starts synchronization or tab work. Only providers
      // that can actually run in this chain are asked, so no stray dialog.
      const primaryProvider = aiProviderSelect.value || 'openai';
      const fallbackOn = aiFallbackEnabledCheckbox.checked;
      const { model: localModel } = globalThis.resolveLocalModelSettings({
        localBaseUrl: localBaseUrlInput.value, localModel: localModelInput.value,
      }, isFirefox);
      const localEligible = LOCAL_PROVIDERS_OPTIONS.includes(primaryProvider)
        && !!localModel
        && (primaryProvider === 'local' || fallbackOn);
      const customEligible = !!customOpenaiBaseUrlInput.value.trim()
        && !!customOpenaiModelInput.value.trim()
        && (primaryProvider === 'custom-openai'
          || (LOCAL_PROVIDERS_OPTIONS.includes(primaryProvider)
            && fallbackOn
            && aiAllowCloudFallbackCheckbox.checked));
      if (localEligible) await requestLocalHostPermissionIfNeeded(localBaseUrlInput.value.trim());
      if (customEligible) await requestCustomHostPermissionIfNeeded(customOpenaiBaseUrlInput.value.trim());

      const result = await chrome.runtime.sendMessage({
        action: 'organizeTabs',
        preserveGroups,
        preserveGroupsMinTabs,
        mergeIntoExisting,
        customInstructions
      });

      if (result.success) {
        let msg = result.refined
          ? `Moved ${result.movedCount} tab(s); created ${result.groupCount} group(s).`
          : `Organized ${result.groupedCount} tab(s) into ${result.groupCount} group(s).`;
        if (result.renamedGroupCount > 0) {
          msg += ` Renamed ${result.renamedGroupCount} duplicate group name(s).`;
        }
        if (result.fallbackInfo) {
          msg += ` Used ${result.providerUsedLabel} after ${result.fallbackInfo.primaryFailedLabel} failed (${result.fallbackInfo.primaryFailedSummary}).`;
        }
        actionStatus.textContent = msg;
        actionStatus.className = 'status success';
      } else {
        actionStatus.textContent = result.error || 'An error occurred';
        actionStatus.className = 'status error';
      }
    } catch (error) {
      actionStatus.textContent = 'Error: ' + error.message;
      actionStatus.className = 'status error';
    } finally {
      organizeTabsBtn.disabled = false;
    }
  });

  // Deduplicate and tidy pinned tabs button
  tidyPinnedBtn.addEventListener('click', async () => {
    tidyPinnedBtn.disabled = true;
    actionStatus.textContent = 'Tidying pinned tabs...';
    actionStatus.className = 'status info';

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'dedupeAndTidyPinned'
      });

      if (result.success) {
        actionStatus.textContent = result.message || 'Pinned tabs tidied.';
        actionStatus.className = 'status success';
      } else {
        actionStatus.textContent = result.error || 'An error occurred';
        actionStatus.className = 'status error';
      }
    } catch (error) {
      actionStatus.textContent = 'Error: ' + error.message;
      actionStatus.className = 'status error';
    } finally {
      tidyPinnedBtn.disabled = false;
    }
  });

  // Ungroup tabs button
  ungroupTabsBtn.addEventListener('click', async () => {
    ungroupTabsBtn.disabled = true;
    actionStatus.textContent = 'Ungrouping tabs...';
    actionStatus.className = 'status info';

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'ungroupTabs'
      });

      if (result.success) {
        actionStatus.textContent = `Ungrouped ${result.ungroupedCount} tab(s).`;
        actionStatus.className = 'status success';
      } else {
        actionStatus.textContent = result.error || 'An error occurred';
        actionStatus.className = 'status error';
      }
    } catch (error) {
      actionStatus.textContent = 'Error: ' + error.message;
      actionStatus.className = 'status error';
    } finally {
      ungroupTabsBtn.disabled = false;
    }
  });
});
