import { GitHubClient } from "./lib/client.js";
import { NotificationReducer } from "./lib/notification-reducer.js";

const DEFAULT_INTERVAL = 60;

let options = process.argv
            .slice(2)
            .filter(arg => arg.startsWith("--"))
            .map(arg => arg.slice(2))
            .reduce((acc, arg) => {
              const [option, value] = arg.indexOf("=") === -1 ? [arg, true] : arg.split("=");
              return Object.assign(acc, { [option.replaceAll(/-([a-z])/gi, (_match, char, ..._args) => char.toUpperCase())]: value });
            }, {});

console.debug(options);

const github = new GitHubClient(options);
const me = await github.me();

const doWork = async () => {
  const notifications = await github.notifications();

  const reducer = new NotificationReducer({ notifications, me });
  reducer.pullRequests = await github.batchRequests(reducer.pullNotifications.map(n => n.subject.url));

  // Case 1: notifications for closed PRs => marking as done
  if (options.cleanupClosedPrs) {
    const notificationsForClosedPRs = reducer.notificationsForClosedPRs;
    console.debug("%d notifications for closed PRs, marking as done…", notificationsForClosedPRs.length);
    notificationsForClosedPRs.forEach(notification => console.debug(notification.pull_request.html_url));
    await github.markAsDone(notificationsForClosedPRs);
  }

  // Case 2: subscribed but someone else already assigned
  if (options.cleanupReassignedPrs) {
    const someoneElseAssigned = reducer.notificationsForReassignedPRs;
    console.debug("%d notifications for PRs assigned to someone else, unsubscribing…", someoneElseAssigned.length);
    await github.unsubscribe(someoneElseAssigned);
  }

  // Case 3: review requested but no reviews pending
  if (options.cleanupReviewPrs) {
    const reviewRequestedAndReviewed = reducer.notificationsForReviewedPRs;
    console.debug("%d notifications for PRs requesting and gotten reviews, unsubscribing…", reviewRequestedAndReviewed.length);
    await github.unsubscribe(reviewRequestedAndReviewed);
  }
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

while(true) {
  if (await github.hasNewNotifications()) {
    await doWork();
  } else {
    console.debug("No new notifications");
  }

  const interval = github.pollInterval || DEFAULT_INTERVAL;
  await delay(interval * 1000);
}
