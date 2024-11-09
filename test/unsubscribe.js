import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import { GitHubClient } from '../lib/client.js';

const interceptor = new FetchInterceptor();
const notifications = [
  {
    url: 'https://api.github.com/notifications/threads/123',
    subscription_url: 'https://api.github.com/notifications/threads/123/subscription',
  },
  {
    url: 'https://api.github.com/notifications/threads/124',
    subscription_url: 'https://api.github.com/notifications/threads/124/subscription',
  },
];

let requests;

beforeEach(() => {
  interceptor.apply();

  interceptor.on('unhandledException', ({ error }) => console.log(error));

  requests = [];

  interceptor.on('request', ({ request, controller }) => {
    requests.push(`${request.method} ${request.url}`);

    // Always respond with HTTP 204
    controller.respondWith(new Response(null, { status: 204 }));
  });
});
afterEach(() => interceptor.dispose());

describe('#markAsDone', async () => {
  it('sends a DELETE request to each thread URL', async () => {
    const github = new GitHubClient({});

    await github.markAsDone(notifications);
    assert.deepEqual(requests, [
      "DELETE https://api.github.com/notifications/threads/123",
      "DELETE https://api.github.com/notifications/threads/124",
    ]);
  });
});

describe('#unsubscribe', async () => {
  it('sends a DELETE request to each thread URL and subscription URL', async () => {
    const github = new GitHubClient({});

    await github.unsubscribe(notifications);
    assert.deepEqual(requests, [
      "DELETE https://api.github.com/notifications/threads/123/subscription",
      "DELETE https://api.github.com/notifications/threads/124/subscription",
      "DELETE https://api.github.com/notifications/threads/123",
      "DELETE https://api.github.com/notifications/threads/124",
    ]);
  });
});
