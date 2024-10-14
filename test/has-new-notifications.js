import assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import { GitHubClient } from '../lib/client.js';

const interceptor = new FetchInterceptor();

let headResponse;

describe('checking for new notifications', async () => {
  beforeEach(() => {
    interceptor.apply();

    interceptor.on('unhandledException', ({ error }) => console.log(error));

    interceptor.on('request', ({ request, controller }) => {
      switch(`${request.method} ${request.url}`) {
        case "GET https://api.github.com/notifications":
          controller.respondWith(Response.json(
            [],
            {
              status: 200,
              headers: { 'Last-Modified': 'Fri, 20 Sep 2024 08:53:07 GMT' }
            }
          ));
          break;
        case "HEAD https://api.github.com/notifications":
          controller.respondWith(headResponse)
          break;
        default:
          controller.errorWith(new Error(`No handler for URL ${request.url} defined`));
      }
    });
  });
  afterEach(() => interceptor.dispose());

  it('always has new notifications on first call', async () => {
    const github = new GitHubClient({});

    assert.equal(await github.hasNewNotifications(), true);
  });

  describe("after initially getting notifications", async () => {
    it('stores the Last-Modified timestamp', async () => {
      const github = new GitHubClient({});

      await github.notifications();
      assert.equal(github.lastModifiedHeaders['https://api.github.com/notifications'], 'Fri, 20 Sep 2024 08:53:07 GMT');
    });

    describe('when HEAD request responds with 304', async () => {
      beforeEach(() => {
        headResponse = new Response(null, { status: 304, headers: { 'x-poll-interval': 123 } });
      });

      it('has no new notifications', async () => {
        const github = new GitHubClient({});

        await github.notifications();
        assert.equal(await github.hasNewNotifications(), false);
      });

      it('stores the poll interval', async () => {
        const github = new GitHubClient({});

        await github.notifications();
        await github.hasNewNotifications();
        assert.equal(github.pollInterval, 123);
      });
    });

    describe('when HEAD request responds with 200', async () => {
      beforeEach(() => {
        headResponse = Response.json( [], { status: 200, headers: { 'X-Poll-Interval': 123 } });
      });

      it('has new notifications', async () => {
        const github = new GitHubClient({});

        await github.notifications();
        assert.equal(await github.hasNewNotifications(), true);
      });

      it('stores the poll interval', async () => {
        const github = new GitHubClient({});

        await github.notifications();
        await github.hasNewNotifications();
        assert.equal(github.pollInterval, 123);
      });
    });

    describe('when HEAD request responds with anything else', async () => {
      beforeEach(() => {
        headResponse = Response.json( [], { status: 201 });
      });

      it('throws an error', async () => {
        const github = new GitHubClient({});

        await github.notifications();
        await assert.rejects(
          async () => {
            await github.hasNewNotifications();
          },
          /Unexpected response status/
        );
      });
    });
  });

});
