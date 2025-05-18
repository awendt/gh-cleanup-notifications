import { GitHubClient } from "./lib/client.js";
import { NotificationReducer } from "./lib/notification-reducer.js";
import { readFileSync } from 'node:fs';

const DEFAULT_INTERVAL = 60;

let options = process.argv
            .slice(2)
            .filter(arg => arg.startsWith("--"))
            .map(arg => arg.slice(2))
            .reduce((acc, arg) => {
              const [option, value] = arg.indexOf("=") === -1 ? [arg, true] : arg.split("=");
              return Object.assign(acc, { [option.replaceAll(/-([a-z])/gi, (_match, char) => char.toUpperCase())]: value });
            }, {});

console.debug(options);

const github = new GitHubClient(options);
const me = await github.me();

const processRule = async (rule, notifications) => {
  switch(rule.action) {
    case "mark-as-done":
      await github.markAsDone(notifications);
      break;
    case "unsubscribe":
      await github.unsubscribe(notifications);
      break;
    case "assign-me":
      await github.assignMe(notifications);
      break;
    default:
      throw new Error(`Unknown action "${rule.action}"`);
  }
};

const doWork = async () => {
  const notifications = await github.notifications();

  const reducer = new NotificationReducer({ notifications, me });
  reducer.pullRequests = await github.batchRequests(reducer.pullNotifications.map(n => n.subject.url));

  // Find intersection between options and built-in rules
  const relevantRules = Object.keys(reducer.builtinRules).filter(rule => Object.keys(options).includes(rule))
  for (const ruleName of relevantRules) {
    const rule = reducer.builtinRules[ruleName];
    const matchedNotifications = reducer.applyRules(...Object.entries(rule.match));

    if (rule.log) { console.debug(rule.log, matchedNotifications.length); }
    matchedNotifications.forEach(notification => console.debug("  ", notification.pull_request.html_url));

    await processRule(rule, matchedNotifications);
  }

  if (options.configFile) {
    const config = JSON.parse(readFileSync(options.configFile));
    for (const rule of config.rules) {
      const matchedNotifications = reducer.applyRules(...Object.entries(rule.match));

      if (rule.log) { console.debug(rule.log, matchedNotifications.length); }
      matchedNotifications.forEach(notification => console.debug("  ", notification.pull_request.html_url));

      await processRule(rule, matchedNotifications);
    }
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
