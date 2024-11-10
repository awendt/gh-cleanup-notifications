# gh-cleanup-notifications

A GitHub (`gh`) CLI extension to clean up your GitHub notifications.

## 📦 Installation

1. Install the `gh` CLI - see the [installation](https://github.com/cli/cli#installation)

   _Installation requires a minimum version (2.0.0) of the GitHub CLI that supports extensions._

2. Install this extension:

   ```sh
   gh extension install awendt/gh-cleanup-notifications
   ```


## ⚡️ Usage

It's recommended to install `moreutils` for the `ts` utility: `brew install moreutils`

Run

```
gh cleanup-notifications --dry-run --verbose --cleanup-closed-prs | ts
```

and watch the extension fetch information about each pull request in your notifications, then find the ones for closed pull requests which would then be marked as done:

```
$ gh cleanup-notifications --verbose --dry-run --cleanup-closed-prs | ts
Nov 09 22:58:56 { verbose: true, dryRun: true }
Nov 09 22:58:56    200 OK /user
Nov 09 22:58:56    200 OK /notifications
Nov 09 22:58:57    200 OK /repos/awendt/gh-cleanup-notifications/pulls/10
Nov 09 22:58:57    200 OK /repos/awendt/gh-cleanup-notifications/pulls/11
Nov 09 22:58:57 0 notifications for closed PRs, marking as done…
Nov 09 22:59:57 No new notifications
```

Notifications will be polled every minute, making use of the `Last-Modified` request header and adhering to the `X-Poll-Interval` response header as described [in this doc](https://docs.github.com/en/rest/activity/notifications?apiVersion=2022-11-28).

> [!NOTE]
> The extension only takes **unread notifications** into account.

## Options

You can choose exactly which notifications will be cleaned up. By default, no notifications will be cleaned up.

If you want to see an option in action but are not yet ready to do any cleanup, you can always specify `--dry-run`.

| Option                     | What it does                                                                                                                                   |
|----------------------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| `--cleanup-closed-prs`     | All notifications for closed pull requests will be marked as done.                                                                             |
| `--cleanup-reassigned-prs` | All notifications with reason `subscribed` for pull requests that have been assigned to another person will be marked as done and unsubscribed |
| `--cleanup-reviewed-prs`   | All notifications with reason `review_requested` for pull requests that have no pending reviews left will be marked as done and unsubscribed   |
| `--dry-run`                | Show the behavior but do not clean up any notifications.                                                                                       |
| `--verbose`                | Print URLs as API requests are being sent.                                                                                                     |
