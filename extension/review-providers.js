/* Hosted code review services shared by the settings page and background script. */
(function (g) {
  'use strict';

  const PAGE_SIZE = 100;
  const MAX_PAGES = 10;
  const GITLAB_ORIGIN = 'https://gitlab.com';
  const AZURE_ORIGIN = 'https://dev.azure.com';
  const providers = Object.freeze({
    github: Object.freeze({ id: 'github', name: 'GitHub' }),
    gitlab: Object.freeze({ id: 'gitlab', name: 'GitLab', permission: GITLAB_ORIGIN + '/*' }),
    azure: Object.freeze({ id: 'azure', name: 'Azure DevOps', permission: AZURE_ORIGIN + '/*' }),
  });

  function getProvider(id) {
    return Object.hasOwn(providers, id) ? providers[id] : providers.github;
  }

  // Match detail pages and subordinate views such as an MR's Changes tab.
  function canonicalUrl(raw) {
    let url;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;

    const legacyAzure = /^([a-z0-9-]+)\.visualstudio\.com$/.exec(url.hostname);
    if (legacyAzure) {
      url.hostname = 'dev.azure.com';
      url.pathname = '/' + legacyAzure[1] + url.pathname;
    }

    let path;
    switch (url.hostname) {
      case 'www.github.com':
      case 'github.com':
        url.hostname = 'github.com';
        path = /^\/[^/]+\/[^/]+\/pull\/\d+(?=\/|$)/i.exec(url.pathname);
        break;
      case 'gitlab.com':
        path = /^\/(?:[^/]+\/)+[^/]+\/-\/merge_requests\/\d+(?=\/|$)/.exec(url.pathname);
        break;
      case 'dev.azure.com':
        path = /^\/[^/]+\/[^/]+\/_git\/[^/]+\/pullrequest\/\d+(?=\/|$)/i.exec(url.pathname);
        break;
      default:
        return null;
    }
    if (!path) return null;
    url.pathname = path[0];
    return url;
  }

  async function readPages(label, readPage) {
    const items = [];
    for (let index = 0; index < MAX_PAGES; index++) {
      const page = await readPage(index);
      if (!Array.isArray(page) || page.length > PAGE_SIZE) {
        throw new Error(label + ' returned an unexpected review list.');
      }
      items.push(...page);
      if (page.length < PAGE_SIZE) return items;
    }
    throw new Error(label + ' returned too many reviews to refresh safely.');
  }

  async function listGitLabReviews(settings, request) {
    const token = settings.gitlabToken?.trim();
    if (!token) throw new Error('Add a GitLab.com token in Code reviews.');
    const headers = { 'PRIVATE-TOKEN': token };
    const items = [];
    for (const scope of ['created_by_me', 'reviews_for_me']) {
      items.push(...await readPages('GitLab', index => {
        const url = new URL('/api/v4/merge_requests', GITLAB_ORIGIN);
        url.search = new URLSearchParams({
          state: 'opened', scope, per_page: PAGE_SIZE, page: index + 1,
        });
        return request(url, headers);
      }));
    }

    return items.map(item => {
      const url = canonicalUrl(item?.web_url);
      if (url?.origin !== GITLAB_ORIGIN) throw new Error('GitLab returned an invalid merge request URL.');
      url.search = '';
      url.hash = '';
      return url.href;
    });
  }

  function pathSegment(value) {
    const name = typeof value === 'string' ? value.trim() : '';
    if (!name || name === '.' || name === '..' || /[\\/]/.test(name)) return null;
    return encodeURIComponent(name);
  }

  async function listAzureReviews(settings, request) {
    const token = settings.azureDevOpsToken?.trim();
    const organization = settings.azureDevOpsOrganization?.trim();
    const project = pathSegment(settings.azureDevOpsProject);
    if (!token || !organization || !project || !/^[a-z0-9][a-z0-9-]*$/i.test(organization)) {
      throw new Error('Set an Azure DevOps organization name, project and token in Code reviews.');
    }

    const headers = { Authorization: 'Basic ' + btoa(':' + token) };
    const accountUrl = AZURE_ORIGIN + '/' + organization;
    const connection = await request(accountUrl + '/_apis/connectionData', headers);
    const userId = connection?.authenticatedUser?.id;
    if (typeof userId !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(userId)) {
      throw new Error('Azure DevOps could not identify the account for this token.');
    }

    const items = [];
    for (const filter of ['creatorId', 'reviewerId']) {
      items.push(...await readPages('Azure DevOps', async index => {
        const url = new URL(accountUrl + '/' + project + '/_apis/git/pullrequests');
        url.search = new URLSearchParams({
          'api-version': '7.1',
          'searchCriteria.status': 'active',
          ['searchCriteria.' + filter]: userId,
          '$skip': index * PAGE_SIZE,
          '$top': PAGE_SIZE,
        });
        const payload = await request(url, headers);
        return payload?.value;
      }));
    }

    return items.map(item => {
      const repo = pathSegment(item?.repository?.name);
      const projectName = pathSegment(item?.repository?.project?.name) || project;
      const id = item?.pullRequestId;
      if (!repo || !Number.isSafeInteger(id) || id < 1) {
        throw new Error('Azure DevOps returned an invalid pull request.');
      }
      return accountUrl + '/' + projectName + '/_git/' + repo + '/pullrequest/' + id;
    });
  }

  async function listUrls(provider, settings) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const request = async (url, headers) => {
      const response = await fetch(String(url), {
        headers: { Accept: 'application/json', ...headers },
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(provider.name + ' API returned HTTP ' + response.status + '.');
      return response.json();
    };

    try {
      const list = provider.id === 'gitlab' ? listGitLabReviews : listAzureReviews;
      return { prUrls: Array.from(new Set(await list(settings, request))) };
    } catch (error) {
      const message = controller.signal.aborted ? provider.name + ' review lookup timed out.' : error.message;
      return { prUrls: [], error: message };
    } finally {
      clearTimeout(timer);
    }
  }

  g.ReviewProviders = { getProvider, canonicalUrl, listUrls };
})(globalThis);
