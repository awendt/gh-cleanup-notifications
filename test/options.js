import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import { GitHubClient } from '../lib/client.js';

const interceptor = new FetchInterceptor();

describe('dryRun: true', async () => {
  beforeEach(() => {
    interceptor.apply();

    interceptor.on('unhandledException', ({ error }) => console.log(error));

    interceptor.on('request', ({ controller }) => {
      controller.respondWith(Response.error())
    });
  });
  afterEach(() => interceptor.dispose());

  it('does not unsubscribe', async () => {
    const github = new GitHubClient({ dryRun: true });

    await assert.doesNotReject(
      async () => {
        await github.unsubscribe([
          { subscription_url: 'https://api.github.com/foo' },
          { subscription_url: 'https://api.github.com/bar' },
        ]);
      },
      /Failed to fetch/
    );
  });

  it('does not mark as done', async () => {
    const github = new GitHubClient({ dryRun: true });

    await assert.doesNotReject(
      async () => {
        await github.markAsDone([
          { url: 'https://api.github.com/foo' },
          { url: 'https://api.github.com/bar' },
        ]);
      },
      /Failed to fetch/
    );
  });
});
