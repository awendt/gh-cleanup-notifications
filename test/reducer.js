import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { NotificationReducer } from '../lib/notification-reducer.js';

import path from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const notifications = JSON.parse(await readFile(path.join(__dirname, 'fixtures', 'notifications.json')));
const [ pr21, pr45, pr179 ] = [
  JSON.parse(await readFile(path.join(__dirname, 'fixtures', 'pr21.json'))),
  JSON.parse(await readFile(path.join(__dirname, 'fixtures', 'pr45.json'))),
  JSON.parse(await readFile(path.join(__dirname, 'fixtures', 'pr179.json'))),
];

const github = {
  notifications: async () => {
    return notifications
  },
  batchRequests: async () => {
    return [ pr45, pr21, pr179 ];
  }
};

describe('Reducer', async () => {
  it('returns pull notifications on #pullNotifications', async () => {
    const reducer = new NotificationReducer({ notifications });

    assert.equal(notifications.length, 4);
    assert.equal(reducer.pullNotifications.length, 3);
  });

  it('returns notifications + PR info on #notificationsWithPullRequests', async () => {
    const reducer = new NotificationReducer({ notifications });
    reducer.pullRequests = [ pr21, pr45, pr179 ];

    assert.equal(reducer.notificationsWithPullRequests.length, 3);
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
      'requested_teams',
      'labels'
    ]);
  });

  describe('#applyRules', async () => {
    let reducer;

    beforeEach(async () => {
      const notifications = await github.notifications();
      reducer = new NotificationReducer({ notifications });
      reducer.pullRequests = [ pr21, pr45, pr179 ];
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
      assert.equal(matchedNotifications.length, 3);
      assert.equal(matchedNotifications[0].pull_request.number, 179);
      assert.equal(matchedNotifications[1].pull_request.number, 45);
      assert.equal(matchedNotifications[2].pull_request.number, 21);
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

    it('supports object filters', async() => {
      const rule = {
        match: {
          "reason": [ "subscribed" ],
          "pull_request.labels.*.name": [ 'dependencies' ]
        },
      };

      const matchedNotifications = reducer.applyRules(...Object.entries(rule.match));
      assert.equal(matchedNotifications.length, 1);
      assert.equal(matchedNotifications[0].pull_request.number, 179);
    });

    describe('supports anything-but', async() => {
      it('works with single condition', async () => {
        const rule = {
          match: {
            "pull_request.state": [ { 'anything-but': [ 'closed' ] } ]
          },
        };

        const matchedNotifications = reducer.applyRules(...Object.entries(rule.match));
        assert.equal(matchedNotifications.length, 2);
        assert.equal(matchedNotifications[0].pull_request.number, 179);
        assert.equal(matchedNotifications[1].pull_request.number, 45);
        assert.deepEqual(matchedNotifications.map(n => n.pull_request.state), ['open', 'open']);
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
        reducer.pullRequests = [ pr21, pr45, pr179 ];

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
