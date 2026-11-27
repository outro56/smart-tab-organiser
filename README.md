# Smart Tab Organiser

Group open tabs by topic in Chrome, Edge, and Firefox. Use an AI model on your computer or a provider you choose.

## Install

Use the browser-specific path below. Build the Firefox ZIP with `python3 scripts/build-release.py` from the repository root.

| Browser | Installation |
| --- | --- |
| Chrome or Edge | Open `chrome://extensions` or `edge://extensions`, enable **Developer mode**, and **Load unpacked** from `extension/`. |
| Firefox desktop 139+ | Open `about:debugging#/runtime/this-firefox`, select **Load Temporary Add-on**, and choose the ZIP in `dist/firefox/`. |

After editing `extension/`, reload the Chrome or Edge extension. For Firefox, rebuild the ZIP and reload the temporary add-on. Firefox removes the temporary add-on on restart. Permanent Firefox installs need [Mozilla signing](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/). The build writes browser ZIPs to `dist/chrome/` and `dist/firefox/`.

## Set up grouping

1. Open **Options → AI models** and choose a provider.
2. In **Grouping**, select **Organize tabs now** or turn on **Group new tabs automatically**.
3. Turn off **Close duplicate tabs** to keep every copy open. Use **Duplicate matching** to control how query parameters and URL fragments are compared.

| On-device setup | Configuration |
| --- | --- |
| Firefox with oMLX | Start oMLX and install `Qwen2.5-Coder-1.5B-4bit`. In **Local model server**, blank fields use that model at `http://127.0.0.1:8000/v1`. |
| Chrome with Gemini Nano | Select **Chrome built-in AI** and use **Check availability** to prepare the model. |
| Other local servers | Enter the server address and exact model name. Use **Test connection / Refresh models** to see what the server offers. |

Use a server on this computer and leave cloud fallback and code review integrations off to keep tab data here. See the [privacy policy](PRIVACY_POLICY.md).

In **Grouping rules and toolbar behaviour**, set excluded sites or choose how to handle existing groups. Use **Pinned tabs** to save URL rules.

The toolbar button tidies pinned tabs by default. Turn on **Group tabs when you click the toolbar icon** to also group tabs with AI. After a click, the button briefly shows a check or an exclamation mark. Hover over it to read the result.

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

[Release notes](RELEASE_NOTES.md) · [MIT license](LICENSE) · [Original project](https://github.com/twisterdotcom/smart-tab-organiser)
