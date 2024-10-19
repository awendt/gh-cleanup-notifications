export class GitHubClient {
  constructor({ verbose, dryRun, batchSignal }) {
    this.requiredHeaders = {
      'User-Agent': 'github.com/awendt/dotfiles',
      'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
    }
    this.verbose = verbose;
    this.dryRun = dryRun;
    this.lastModifiedHeaders = {};
    this.batchSignal = batchSignal || (() => {});
  }

  async me() {
    const json = await this.fetch("https://api.github.com/user");
    return json.login;
  }

  async hasNewNotifications() {
    const url = 'https://api.github.com/notifications';
    const lastModified = this.lastModifiedHeaders[url];
    if (lastModified) {
      const headers = { 'If-Modified-Since': lastModified };
      // We are not using this.fetch because it already does too much
      const response = await fetch(url, {
        method: 'HEAD',
        headers: Object.assign({}, headers, this.requiredHeaders)
      });
      this.pollInterval = response.headers.get('x-poll-interval');
      if (response.status === 304) { return false; }
      if (response.status === 200) { return true; }

      throw new Error(`Unexpected response status: ${response.status} ${response.statusText}`);
    }
    return true;
  }

  async notifications() {
    const url = "https://api.github.com/notifications";
    const callback = (headers) => {
      if (headers.has('Last-Modified')) {
        this.lastModifiedHeaders[url] = headers.get('Last-Modified');
      }
    };

    return await this.fetch(url, {}, callback);
  }

  async batchRequests(urls, { method, headers } = {}) {
    const BATCH_SIZE = 10;
    const bag = urls.slice(0); // operate on a shallow copy
    let responses = [];

    while(bag.length > 0) {
      let batch = bag.splice(0, BATCH_SIZE);
      this.batchSignal(batch.length);

      responses = responses.concat(await this.parallelRequests(batch, { method, headers }));
    }
    return responses;
  }

  async parallelRequests(urls, { method, headers }) {
    return Promise.all(
      urls.map(async url => {
        return await this.fetch(url, { method, headers });
      })
    )
  }

  async markAsDone(notifications) {
    if (this.dryRun) { return; }

    if (notifications.length > 0) {
      return this.batchRequests(notifications.map(notification => notification.url), { method: 'DELETE'});
    }
  }

  async unsubscribe(notifications) {
    if (this.dryRun) { return; }

    await this.batchRequests(notifications.flatMap(notification => notification.subscription_url), { method: 'DELETE'});
    await this.markAsDone(notifications);
  }

  async fetch(url, { method, headers } = {}, responseHeadersCallback) {
    const nextPattern = /(?<=<)([\S]*)(?=>; rel="Next")/i;
    let pagesRemaining = true;
    let data = [];

    while(pagesRemaining) {
      const response = await fetch(url, { method, headers: Object.assign({}, headers, this.requiredHeaders) });

      if (!response.ok) {
        throw new Error(`Response status: ${response.status} ${response.statusText}`);
      }

      if (responseHeadersCallback) { responseHeadersCallback(response.headers); }

      if (this.verbose) { console.debug("  ", response.status, response.statusText, url.slice('https://api.github.com'.length)); }

      if (response.status == 204) { return null; }

      // https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api
      const linkHeader = response.headers.get("Link");
      pagesRemaining = linkHeader && linkHeader.includes(`rel="next"`);
      if (pagesRemaining) {
        url = linkHeader.match(nextPattern)[0];
      }

      let parsed = await response.json();
      data.push(parsed);
    }

    if (data.length === 1) { return data[0]; }

    return data.flat();
  }
}
