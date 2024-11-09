import assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import { GitHubClient } from '../lib/client.js';

const interceptor = new FetchInterceptor();

describe('#me', async () => {
  beforeEach(() => {
    interceptor.apply();

    interceptor.on('unhandledException', ({ error }) => console.log(error));

    interceptor.on('request', ({ request, controller }) => {
      switch(request.url) {
        case "https://api.github.com/user":
          controller.respondWith(Response.json(
            { login: "awendt", node_id: "MDQ6VXNlcjExOTY0" },
            { status: 200 }
          ));
          break;
        default:
          controller.errorWith(new Error(`No handler for URL ${request.url} defined`));
      }
    });
  });
  afterEach(() => interceptor.dispose());

  it('returns the login of the user', async () => {
    const github = new GitHubClient({});

    assert.equal(await github.me(), 'awendt');
  });
});
