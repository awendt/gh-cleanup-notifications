export class NotificationReducer {
  notificationsWithPullRequests = [];

  constructor({ notifications, me }) {
    this.pullNotifications = notifications.filter(notification => notification.subject.type === "PullRequest");
    this.me = me;
  }

  set pullRequests(list) {
    this.notificationsWithPullRequests = this.pullNotifications.reduce((acc, notification) => {
      // Find information about PR
      const pullRequest = list.find(pr => pr.url === notification.subject.url);
      acc.push(Object.assign({}, notification, { pull_request: pullRequest }));
      return acc;
    }, []);
  }

  get builtinRules() {
    return {
      cleanupClosedPrs: {
        match: {
          "pull_request.state": [ "closed" ]
        },
        log: "%d notifications for closed PRs, marking as done…",
        action: "mark-as-done"
      },
      cleanupReassignedPrs: {
        match: {
          "reason": [ "subscribed" ],
          "pull_request.assignee": [ { 'anything-but': [ this.me, null ] } ]
        },
        log: "%d notifications for PRs assigned to someone else, unsubscribing…",
        action: "unsubscribe"
      },
      cleanupReviewedPrs: {
        match: {
          "reason": [ "review_requested" ],
          "pull_request.requested_reviewers": [ { empty: true } ],
          "pull_request.requested_teams": [ { empty: true } ]
        },
        log: "%d notifications for PRs requesting and gotten reviews, unsubscribing…",
        action: "unsubscribe"
      }
    }
  }

  applyRules(...args) {
    return this.notificationsWithPullRequests.filter(obj => {
      return args.every(([path, values]) => {
        const reduced = path.split('.').reduce((acc, current, index, array) => {
          if (acc.skip) {
            return { obj: acc.obj };
          };

          if (current == '*') {
            acc.skip = true;
            let next = array[index+1];
            acc.obj = acc.obj.map(each => each[next]);
          } else {
            acc.obj = acc.obj[current];
          }

          return acc;
        }, { obj }).obj;
        const isStringOrNumber = (value) => ['string', 'number'].includes(typeof value);

        if (values.every(isStringOrNumber)) {
          if (Array.isArray(reduced)) {
            return values.every((value) => reduced.includes(value));
          } else {
            return values.includes(reduced);
          }
        }
        if (values[0]?.['anything-but']) {
          return !values[0]?.['anything-but'].includes(reduced);
        }
        if (values[0]?.['empty']) {
          if (Array.isArray(reduced)) {
            return reduced.length === 0;
          }

          return (typeof reduced !== 'undefined');
        }

        throw new Error(`Unexpected values: ${JSON.stringify(values)}`);
      });
    });
  }
}
