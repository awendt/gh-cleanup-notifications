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

  get notificationsForClosedPRs() {
    return this.notificationsWithPullRequests.filter(notification => notification.pull_request.state === "closed");
  }

  get notificationsForReassignedPRs() {
    return this.notificationsWithPullRequests.filter((notification) => {
      return notification.reason === "subscribed" && notification.pull_request.assignee != this.me && notification.pull_request.assignee != ""
    });
  }

  get notificationsForReviewedPRs() {
    return this.notificationsWithPullRequests.filter((notification) => {
      const pendingReviews = notification.pull_request.requested_reviewers.length + notification.pull_request.requested_teams.length;
      return notification.reason === "review_requested" && pendingReviews === 0
    });
  }
}
