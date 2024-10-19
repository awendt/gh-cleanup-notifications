import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import { GitHubClient } from '../lib/client.js';

const interceptor = new FetchInterceptor();

describe('#batchRequests', async () => {
  beforeEach(() => {
    interceptor.apply();

    interceptor.on('unhandledException', ({ error }) => console.log(error));

    interceptor.on('request', async ({ request, controller }) => {
      switch(request.url) {
        case "https://api.github.com/batch1":
        case "https://api.github.com/batch2":
          controller.respondWith(Response.json(
            { url: request.url, time: new Date() },
            { status: 200 }
          ));
          break;
        default:
          controller.errorWith(new Error(`No handler for URL ${request.url} defined`));
      }
    });
  });
  afterEach(() => interceptor.dispose());

  it('runs up to 10 requests in parallel', async () => {
    const batchSignal = mock.fn();
    const github = new GitHubClient({ batchSignal });

    await github.batchRequests([
      'https://api.github.com/batch1',
      'https://api.github.com/batch1',
      'https://api.github.com/batch1',
      'https://api.github.com/batch1',
      'https://api.github.com/batch1',
      'https://api.github.com/batch1',
      'https://api.github.com/batch1',
      'https://api.github.com/batch1',
      'https://api.github.com/batch1',
      'https://api.github.com/batch1',
      'https://api.github.com/batch2',
    ]);

    // There are 2 batches, the first with 10 URLs, the second with 1 URL
    assert.strictEqual(batchSignal.mock.callCount(), 2);
    assert.deepEqual(batchSignal.mock.calls[0].arguments, [10]);
    assert.deepEqual(batchSignal.mock.calls[1].arguments, [1]);
  });
});
