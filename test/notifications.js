import assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import { GitHubClient } from '../lib/client.js';

import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const interceptor = new FetchInterceptor();

describe('#notifications', async () => {
  beforeEach(() => {
    interceptor.apply();

    interceptor.on('unhandledException', ({ error }) => console.log(error));

    interceptor.on('request', ({ request, controller }) => {
      switch(request.url) {
        case "https://api.github.com/notifications":
          controller.respondWith(new Response(
            createReadStream(path.join(__dirname, 'fixtures', 'notifications.json')),
            { status: 200 }
          ));
          break;
        default:
          controller.errorWith(new Error(`No handler for URL ${request.url} defined`));
      }
    });
  });
  afterEach(() => interceptor.dispose());

  it('returns parsed JSON', async () => {
    const github = new GitHubClient({});

    const notifications = await github.notifications();
    assert.equal(notifications.length, 3);
    assert.deepEqual(Object.keys(notifications[0]), [ 'id', 'unread', 'reason', 'updated_at', 'last_read_at', 'subject', 'repository', 'url', 'subscription_url' ]);
  });
});

describe('#notifications with pagination', async () => {
  beforeEach(() => {
    interceptor.apply();

    interceptor.on('unhandledException', ({ error }) => console.log(error));

    interceptor.on('request', ({ request, controller }) => {
      switch(request.url) {
        case "https://api.github.com/notifications":
          controller.respondWith(new Response(
            createReadStream(path.join(__dirname, 'fixtures', 'notifications.json')),
            {
              status: 200,
              headers: { 'Link': '<https://api.github.com/notifications?page=2>; rel="next", <https://api.github.com/notifications?page=2>; rel="last", <https://api.github.com/notifications>; rel="first"' }
            }
          ));
          break;
        case "https://api.github.com/notifications?page=2":
          controller.respondWith(new Response(
            createReadStream(path.join(__dirname, 'fixtures', 'notifications.json')),
            {
              status: 200,
            }
          ));
          break;
        default:
          controller.errorWith(new Error(`No handler for URL ${request.url} defined`));
      }
    });
  });
  afterEach(() => interceptor.dispose());

  it('returns results from all pages', async () => {
    const github = new GitHubClient({});

    const notifications = await github.notifications();
    assert.equal(notifications.length, 6);
    assert.ok(notifications.every(notification => notification.unread));
  });
});
