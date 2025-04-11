import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
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
    const reducer = new NotificationReducer({ notifications });

    assert.equal(notifications.length, 3);
    assert.equal(reducer.pullNotifications.length, 2);
  });

  it('returns notifications + PR info on #notificationsWithPullRequests', async () => {
    const reducer = new NotificationReducer({ notifications });
    reducer.pullRequests = [ pr21, pr45 ];

    assert.equal(reducer.notificationsWithPullRequests.length, 2);
    assert.deepEqual(Object.keys(reducer.notificationsWithPullRequests[0].pull_request), [
      'url',
      'html_url',
      'number',
      'state',
      'title',
      'assignee',
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

  it('returns closed PRs #notificationsForClosedPRs', async () => {
    const reducer = new NotificationReducer({ notifications });
    reducer.pullRequests = [ pr21, pr45 ];

    assert.equal(reducer.notificationsForClosedPRs.length, 1);
    assert.equal(reducer.notificationsForClosedPRs[0].subject.url, "https://api.github.com/repos/babbel/terraform-aws-acm/pulls/21");
  });

  it('returns closed PRs #notificationsForReassignedPRs', async () => {
    const notifications = await github.notifications();
    const reducer = new NotificationReducer({ notifications, me: 'awendt' });
    reducer.pullRequests = [ pr21, pr45 ];

    assert.equal(reducer.notificationsForReassignedPRs.length, 1);
    assert.equal(reducer.notificationsForReassignedPRs[0].subject.url, "https://api.github.com/repos/babbel/terraform-aws-athena/pulls/45");
  });

  it('returns closed PRs #notificationsForReviewedPRs', async () => {
    const notifications = await github.notifications();
    const reducer = new NotificationReducer({ notifications });
    reducer.pullRequests = [ pr21, pr45 ];

    assert.equal(reducer.notificationsForReviewedPRs.length, 1);
    assert.equal(reducer.notificationsForReviewedPRs[0].subject.url, "https://api.github.com/repos/babbel/terraform-aws-acm/pulls/21");
  });

  describe('#applyRules', async () => {
    let reducer;

    beforeEach(async () => {
      const notifications = await github.notifications();
      reducer = new NotificationReducer({ notifications });
      reducer.pullRequests = [ pr21, pr45 ];
    });

    it('matches a single condition', async() => {
      const rule = {
        match: {
          "pull_request.state": [ "closed" ]
        },
      };

      const matchedNotifications = reducer.applyRules(...Object.entries(rule.match));
      assert.equal(matchedNotifications.length, 1);
      assert.equal(matchedNotifications[0].pull_request.number, 21);
    });

    it('matches a single condition with multiple values', async() => {
      const rule = {
        match: {
          "pull_request.state": [ "closed", "open" ]
        },
      };

      const matchedNotifications = reducer.applyRules(...Object.entries(rule.match));
      assert.equal(matchedNotifications.length, 2);
      assert.equal(matchedNotifications[0].pull_request.number, 45);
      assert.equal(matchedNotifications[1].pull_request.number, 21);
    });

    it('matches several conditions', async() => {
      const rule = {
        match: {
          "reason": [ "subscribed" ],
          "pull_request.assignee": [ 'jansiwy' ]
        },
      };

      const matchedNotifications = reducer.applyRules(...Object.entries(rule.match));
      assert.equal(matchedNotifications.length, 1);
      assert.equal(matchedNotifications[0].pull_request.number, 45);
    });

    describe('supports anything-but', async() => {
      it('works with single condition', async () => {
        const rule = {
          match: {
            "pull_request.state": [ { 'anything-but': [ 'closed' ] } ]
          },
        };

        const matchedNotifications = reducer.applyRules(...Object.entries(rule.match));
        assert.equal(matchedNotifications.length, 1);
        assert.equal(matchedNotifications[0].pull_request.number, 45);
        assert.equal(matchedNotifications[0].pull_request.state, 'open');
      });

      it ('works in composite condition', async () => {
        const rule = {
          match: {
            "reason": [ "subscribed" ],
            "pull_request.assignee": [ { 'anything-but': [ null ] } ]
          },
        };

        const matchedNotifications = reducer.applyRules(...Object.entries(rule.match));
        assert.equal(matchedNotifications.length, 1);
        assert.equal(matchedNotifications[0].pull_request.number, 45);
        assert.equal(matchedNotifications[0].pull_request.assignee, 'jansiwy');
      });
    });

    describe('supports empty', async() => {
      it('checks for existence', async () => {
        const rule = {
          match: {
            "pull_request.missing_key": [ { empty: true } ]
          },
        };

        const matchedNotifications = reducer.applyRules(...Object.entries(rule.match));
        assert.equal(matchedNotifications.length, 0);
      });

      it('finds empty arrays', async () => {
        const rule = {
          match: {
            "reason": [ "review_requested" ],
            "pull_request.requested_reviewers": [ { empty: true } ]
          },
        };

        const matchedNotifications = reducer.applyRules(...Object.entries(rule.match));
        assert.equal(matchedNotifications.length, 1);
        assert.equal(matchedNotifications[0].pull_request.number, 21);
        assert.equal(matchedNotifications[0].pull_request.requested_reviewers.length, 0);
      });
    });

    it('returns closed PRs', async () => {
      const rule = reducer.builtinRules.cleanupClosedPrs;
      const prsWhereRulesApply = reducer.applyRules(...Object.entries(rule.match));
      assert.equal(prsWhereRulesApply.length, 1);
      assert.equal(prsWhereRulesApply[0].subject.url, "https://api.github.com/repos/babbel/terraform-aws-acm/pulls/21");
    });

    describe('reassigned PRs', async () => {
      it('returns reassigned PRs for one person', async () => {
        const rule = reducer.builtinRules.cleanupReassignedPrs;
        const prsWhereRulesApply = reducer.applyRules(...Object.entries(rule.match));
        assert.equal(prsWhereRulesApply.length, 1);
        assert.equal(prsWhereRulesApply[0].subject.url, "https://api.github.com/repos/babbel/terraform-aws-athena/pulls/45");
      });

      it('returns no reassigned PRs for another person', async () => {
        const reducer = new NotificationReducer({ notifications, me: 'jansiwy' });
        reducer.pullRequests = [ pr21, pr45 ];

        const rule = reducer.builtinRules.cleanupReassignedPrs;
        const prsWhereRulesApply = reducer.applyRules(...Object.entries(rule.match));
        assert.equal(prsWhereRulesApply.length, 0);
      });
    });

    it('returns reviewed PRs', async () => {
      const reducer = new NotificationReducer({ notifications });
      reducer.pullRequests = [ pr21, pr45 ];

      const rule = reducer.builtinRules.cleanupReviewedPrs;
      const prsWhereRulesApply = reducer.applyRules(...Object.entries(rule.match));
      assert.equal(prsWhereRulesApply.length, 1);
      assert.equal(prsWhereRulesApply[0].subject.url, "https://api.github.com/repos/babbel/terraform-aws-acm/pulls/21");
    });
  });

});
