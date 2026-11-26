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

Use a server on this computer and leave provider fallback and GitHub integrations off to keep tab data here. For cloud or GitHub features, see what data they use in the [privacy policy](PRIVACY_POLICY.md).

In **Grouping rules and toolbar behaviour**, set excluded sites, choose how to handle existing groups, or add AI grouping to the toolbar click. Use **Pinned tabs** to save URL rules. Use **GitHub** to group your open pull requests, review requests, and issue tabs.

## Develop

All runtime files live in `extension/`. The build packages those files with a browser-specific manifest. Run `sh scripts/validate.sh` with Node.js and Python 3 to run the tests, validate the store assets, and rebuild both outputs.

[Release notes](RELEASE_NOTES.md) · [MIT license](LICENSE) · [Original project](https://github.com/twisterdotcom/smart-tab-organiser)
