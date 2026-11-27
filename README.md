# Smart Tab Organiser

Group open tabs by topic in Chrome, Edge, and Firefox. Use an AI model on your computer or a provider you choose.

## Install

Use the browser-specific path below. Build the Firefox ZIP with `python3 scripts/build-release.py` from the repository root.

| Browser | Installation |
| --- | --- |
| Chrome or Edge | Open `chrome://extensions` or `edge://extensions`, enable **Developer mode**, and **Load unpacked** from `extension/`. |
| Firefox desktop 139+ | Download the signed XPI from [GitHub Releases](https://github.com/outro56/smart-tab-organiser/releases/latest). In `about:addons`, open the gear menu and choose **Install Add-on From File…**. |

Install signed 1.3.3 or later once and keep Firefox's automatic add-on updates enabled. Firefox checks the fork for newer signed releases. To test a local build, open `about:debugging#/runtime/this-firefox`, select **Load Temporary Add-on**, and choose the ZIP in `dist/firefox/`. Firefox removes temporary add-ons on restart.

## Set up grouping

Right-click the extension icon and choose **Edit extension options** to open Settings. Use a regular Firefox window if the extension lacks private-window access.

1. Open **Options → AI models** and choose **Group by domain (on-device)** or an AI provider.
2. In **Grouping**, select **Organize tabs now** or turn on **Group new tabs automatically**.
3. Turn off **Close duplicate tabs** to keep every copy open. Use **Duplicate matching** to control how query parameters and URL fragments are compared.

Use **More actions → Reorganize this window**, or the matching toolbar menu item, to refine existing groups once with your saved provider and grouping rules.

Domain grouping needs no model or server. It uses hostnames, so `www.example.com` joins `example.com` and other subdomains stay separate. A lone tab can join an existing matching group. New groups follow the minimum size and window limit. When no AI model is available, the extension falls back to this mode by default. Change this under **AI models → Fallback settings**.

| On-device setup | Configuration |
| --- | --- |
| Firefox with oMLX | Start oMLX and install `Qwen2.5-Coder-1.5B-4bit`. In **Local model server**, blank fields use that model at `http://127.0.0.1:8000/v1`. |
| Chrome with Gemini Nano | Select **Chrome built-in AI** and use **Check availability** to prepare the model. |
| Other local servers | Enter the server address and exact model name. Use **Test connection / Refresh models** to see what the server offers. |

Use a server on this computer and leave cloud fallback and code review integrations off to keep tab data here. See the [privacy policy](PRIVACY_POLICY.md).

In **Grouping rules and toolbar behaviour**, set excluded sites or choose how to handle existing groups. Use **Pinned tabs** to save URL rules.

**Merge groups with matching names** is on by default. Grouping reuses matching groups in the current window and combines existing duplicates, ignoring case and extra spaces. Tabs join the leftmost matching group, which keeps its name and color.

**Limit groups per window** is off by default. Enable it to start at 16 groups, or set your own maximum. During AI grouping, every group in the window counts, including Misc. The extension can still reuse matching groups at the limit. Duplicate merges can free space.

The toolbar button tidies pinned tabs by default. Turn on **Group tabs when you click the toolbar icon** to also group tabs with AI. After a click, the button briefly shows a check or an exclamation mark. Hover over it to read the result.

## Debug grouping

| Where | How to see the logs |
| --- | --- |
| Firefox extension | Open `about:debugging` → **This Firefox** → **Inspect** next to **Smart Tab Organiser** → **Console**. [Firefox guide](https://extensionworkshop.com/documentation/develop/debugging/) |
| Chrome or Edge extension | Open `chrome://extensions` or `edge://extensions`, turn on **Developer mode**, and select **service worker** under **Inspect views** → **Console**. [Chrome guide](https://developer.chrome.com/docs/extensions/get-started/tutorial/debug) |
| oMLX on macOS | Run `tail -F ~/.omlx/logs/server.log` in Terminal. Look for `Chat completion` to see the model, token counts, and duration. |

Open the console before reproducing the issue. Local model servers such as oMLX report the model’s context size. The extension uses it to split large tab lists and merges groups with the same name. In the oMLX log, `finish_reason=length` means the reply reached its output limit.

## Group code reviews

In **Code reviews**, choose a provider and select **Refresh PR group**. The extension opens missing requests you authored or are assigned to review in a **PRs** group. Requests that stop matching leave the group and stay open. Turn on **Enable PR tab group** to refresh it when you tidy or organize tabs.

| Provider | What you need |
| --- | --- |
| GitHub | A token with access to the relevant repositories. |
| GitLab.com | A personal access token with `read_api`. |
| Azure DevOps Services | Organization and project names, plus an organization-scoped token with **Code (Read)**. |

Issue labels and the **Closed** issue group use GitHub separately.

## Develop

All runtime files live in `extension/`. The build packages those files with a browser-specific manifest. Run `sh scripts/validate.sh` with Node.js and Python 3 to run the tests, validate the store assets, and rebuild both outputs.

### Sign and release for Firefox

Mozilla signs the extension for permanent installation. We use unlisted signing and distribute the signed file through GitHub Releases.

1. Bump `version` in `extension/manifest.json`. From the committed release revision, build the Firefox ZIP and archive the matching source.

   ```sh
   python3 scripts/build-release.py
   git archive --format=zip -o dist/firefox/source.zip HEAD extension scripts/build-release.py README.md LICENSE PRIVACY_POLICY.md
   ```

2. Sign in to Mozilla’s Developer Hub. Open the existing **Smart Tab Organiser** entry and select **Upload a New Version**. Use **On your own** (unlisted). Upload `dist/firefox/smart-tab-organiser-firefox-vVERSION.zip`, provide `dist/firefox/source.zip` at the source code prompt, and submit. [Developer Hub](https://addons.mozilla.org/developers/addons) · [Mozilla submission guide](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/#self-distribution)
3. After approval, open the version page and download the signed XPI. Save it as `dist/firefox/smart-tab-organiser-firefox-vVERSION-signed.xpi`.
4. Attach the signed XPI to the matching `vVERSION` GitHub release before publishing it as the latest stable release. The [release workflow](.github/workflows/firefox-update.yml) publishes `firefox-updates.json`. Verify that Firefox updates an older signed install in a test profile.

[Release notes](RELEASE_NOTES.md) · [MIT license](LICENSE) · [Original project](https://github.com/twisterdotcom/smart-tab-organiser)
