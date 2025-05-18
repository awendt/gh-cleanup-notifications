import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import { GitHubClient } from '../lib/client.js';

const interceptor = new FetchInterceptor();

const notifications = [
  {
    url: 'https://api.github.com/notifications/threads/123',
    subscription_url: 'https://api.github.com/notifications/threads/123/subscription',
    pull_request: {
      issue_url: 'https://api.github.com/repos/foo/bar/issues/654',
    },
  },
  {
    url: 'https://api.github.com/notifications/threads/124',
    subscription_url: 'https://api.github.com/notifications/threads/124/subscription',
    pull_request: {
      issue_url: 'https://api.github.com/repos/foo/bar/issues/655',
    },
  },
];

let requests;

describe('#assignMe', async () => {
  beforeEach(() => {
    interceptor.apply();

    interceptor.on('unhandledException', ({ error }) => console.log(error));

    requests = [];

    interceptor.on('request', async ({ request, controller }) => {
      const route = `${request.method} ${request.url}`;
      const body = request.body ? await request.clone().json() : null;
      requests.push({ route, body });
      switch(route) {
        case "GET https://api.github.com/user":
          controller.respondWith(Response.json(
            { login: 'user-to-assign' },
            { status: 200 }
          ));
          break;
        case "POST https://api.github.com/repos/foo/bar/issues/654/assignees":
        case "POST https://api.github.com/repos/foo/bar/issues/655/assignees":
          controller.respondWith(new Response(
            '{}',
            { status: 201 }
          ));
          break;
        case "DELETE https://api.github.com/notifications/threads/123":
        case "DELETE https://api.github.com/notifications/threads/124":
          controller.respondWith(new Response(
            '{}',
            { status: 200 }
          ));
          break;
        default:
          controller.errorWith(new Error(`No handler for URL ${request.url} defined`));
      }
    });
  });
  afterEach(() => interceptor.dispose());

  it('determines current user, assigns PRs, marks notifications as done', async () => {
    const github = new GitHubClient({});

    await github.assignMe(notifications);
    assert.deepEqual(requests, [
      { route: 'GET https://api.github.com/user', body: null },
      { route: 'POST https://api.github.com/repos/foo/bar/issues/654/assignees', body: { assignees: ['user-to-assign'] } },
      { route: 'POST https://api.github.com/repos/foo/bar/issues/655/assignees', body: { assignees: ['user-to-assign'] } },
      { route: 'DELETE https://api.github.com/notifications/threads/123', body: null },
      { route: 'DELETE https://api.github.com/notifications/threads/124', body: null },
    ]);
  });
});
