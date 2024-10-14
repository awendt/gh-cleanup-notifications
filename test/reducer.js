import assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import { NotificationReducer } from '../lib/notification-reducer.js';

import path from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const github = {
  notifications: async () => {
    const data = await readFile(path.join(__dirname, 'fixtures', 'notifications.json'));
    return JSON.parse(data);
  },
  batchRequests: async () => {
    const pr21 = JSON.parse(await readFile(path.join(__dirname, 'fixtures', 'pr21.json')));
    const pr45 = JSON.parse(await readFile(path.join(__dirname, 'fixtures', 'pr45.json')));
    return [ pr45, pr21 ];
  }
};

const notifications = JSON.parse(await readFile(path.join(__dirname, 'fixtures', 'notifications.json')));
const [ pr21, pr45 ] = [
  JSON.parse(await readFile(path.join(__dirname, 'fixtures', 'pr21.json'))),
  JSON.parse(await readFile(path.join(__dirname, 'fixtures', 'pr45.json'))),
];

describe('Reducer', async () => {
  it('returns pull notifications on #pullNotifications', async () => {
    const reducer = new NotificationReducer({ github, notifications });

    assert.equal(notifications.length, 3);
    assert.equal(reducer.pullNotifications.length, 2);
  });

  it('returns notifications + PR info on #notificationsWithPullRequests', async () => {
    const reducer = new NotificationReducer({ github, notifications });
    reducer.pullRequests = [ pr21, pr45 ];

    assert.equal(reducer.notificationsWithPullRequests.length, 2);
    assert.deepEqual(Object.keys(reducer.notificationsWithPullRequests[0].pull_request), [
      'url',
      'html_url',
      'number',
      'state',
      'title',
      'user',
      'body',
      'created_at',
      'updated_at',
      'closed_at',
      'merged_at',
      'merge_commit_sha',
      'requested_reviewers',
      'requested_teams'
    ]);
  });

  it('returns closed PRs #notificationsForClosedPRs', async (t) => {
    const reducer = new NotificationReducer({ github, notifications });
    reducer.pullRequests = [ pr21, pr45 ];

    assert.equal(reducer.notificationsForClosedPRs.length, 1);
    assert.equal(reducer.notificationsForClosedPRs[0].subject.url, "https://api.github.com/repos/babbel/terraform-aws-acm/pulls/21");
  });

  it('returns closed PRs #notificationsForReassignedPRs', async (t) => {
    const notifications = await github.notifications();
    const reducer = new NotificationReducer({ github, notifications, me: 'awendt' });
    reducer.pullRequests = [ pr21, pr45 ];

    assert.equal(reducer.notificationsForReassignedPRs.length, 1);
    assert.equal(reducer.notificationsForReassignedPRs[0].subject.url, "https://api.github.com/repos/babbel/terraform-aws-athena/pulls/45");
  });

  it('returns closed PRs #notificationsForReviewedPRs', async (t) => {
    const notifications = await github.notifications();
    const reducer = new NotificationReducer({ github, notifications });
    reducer.pullRequests = [ pr21, pr45 ];

    assert.equal(reducer.notificationsForReviewedPRs.length, 1);
    assert.equal(reducer.notificationsForReviewedPRs[0].subject.url, "https://api.github.com/repos/babbel/terraform-aws-acm/pulls/21");
  });
});
