#!/usr/bin/env python3
"""Generate a Firefox update manifest for a signed GitHub release asset."""

import argparse
import hashlib
import json
import re
from pathlib import Path
from zipfile import ZipFile


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tag", help="GitHub release tag, such as v1.3.3")
    parser.add_argument("repository", help="GitHub repository in owner/name form")
    parser.add_argument("xpi", type=Path, help="Path to the Mozilla-signed XPI")
    parser.add_argument("--output", type=Path, default=Path("firefox-updates.json"))
    args = parser.parse_args()

    if not re.fullmatch(r"v\d+(?:\.\d+){1,3}", args.tag):
        parser.error("The release tag must start with v and contain a numeric version.")
    if not re.fullmatch(r"[\w.-]+/[\w.-]+", args.repository):
        parser.error("The repository must be in owner/name form.")

    version = args.tag[1:]
    asset_name = f"smart-tab-organiser-firefox-{args.tag}-signed.xpi"
    if args.xpi.name != asset_name:
        parser.error(f"Expected the signed release asset to be named {asset_name}.")

    with ZipFile(args.xpi) as xpi:
        manifest = json.loads(xpi.read("manifest.json"))
        if not {"META-INF/mozilla.rsa", "META-INF/cose.sig"} <= set(xpi.namelist()):
            parser.error("The XPI lacks Mozilla signature entries.")

    release_url = f"https://github.com/{args.repository}/releases"
    expected_feed = f"{release_url}/latest/download/firefox-updates.json"
    gecko = manifest.get("browser_specific_settings", {}).get("gecko", {})
    if manifest.get("version") != version or gecko.get("id") != "smart-tab-organiser@outro56":
        parser.error("The XPI version or add-on ID does not match this release.")
    if gecko.get("update_url") != expected_feed:
        parser.error("The XPI update URL does not match the repository's update feed.")

    digest = hashlib.sha256(args.xpi.read_bytes()).hexdigest()
    update = {
        "version": version,
        "update_link": f"{release_url}/download/{args.tag}/{asset_name}",
        "update_hash": f"sha256:{digest}",
        "applications": {"gecko": {"strict_min_version": gecko["strict_min_version"]}},
    }
    args.output.write_text(json.dumps({"addons": {gecko["id"]: {"updates": [update]}}}, indent=2) + "\n",
                           encoding="utf-8")


if __name__ == "__main__":
    main()
