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

  get notificationsForClosedPRs() {
    return this.notificationsWithPullRequests.filter(notification => notification.pull_request.state === "closed");
  }

  get notificationsForReassignedPRs() {
    return this.notificationsWithPullRequests.filter((notification) => {
      return notification.reason === "subscribed" && notification.pull_request.assignee != this.me && notification.pull_request.assignee !== null
    });
  }

  get notificationsForReviewedPRs() {
    return this.notificationsWithPullRequests.filter((notification) => {
      const pendingReviews = notification.pull_request.requested_reviewers.length + notification.pull_request.requested_teams.length;
      return notification.reason === "review_requested" && pendingReviews === 0
    });
  }

  applyRules(...args) {
    return this.notificationsWithPullRequests.filter(obj => {
      return args.every(([path, values]) => {
        const reduced = path.split('.').reduce((acc, current) => acc[current], obj);
        const isStringOrNumber = (value) => ['string', 'number'].includes(typeof value);

        if (values.every(isStringOrNumber)) {
          return values.includes(reduced);
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
