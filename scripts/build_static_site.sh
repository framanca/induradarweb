#!/usr/bin/env bash

set -euo pipefail

output_dir="${1:-build/static}"
lead_endpoint="${LEAD_ENDPOINT:-}"
contact_endpoint="${CONTACT_ENDPOINT:-}"
report_endpoint="${REPORT_ENDPOINT:-https://gwmwkxvrgctglyjmlqnb.supabase.co/functions/v1/get-report}"
supabase_url="${SUPABASE_URL:-https://gwmwkxvrgctglyjmlqnb.supabase.co}"
supabase_publishable_key="${SUPABASE_PUBLISHABLE_KEY:-sb_publishable_nd7p5sHU6Hlj5KspxhFekQ_ldhPc27I}"

rm -rf "$output_dir"
mkdir -p "$output_dir"

cp -R site/. "$output_dir/"

# HMI NX is isolated from the InduRadar portal. No editor accounts or cloud state.
# Never publish the reference server, tests, private records or engineering policy.
hmi_scripts=(core.js model.js service.js data.js widgets.js transport.js runtime.js exporter.js panels.js app.js)
for source in "${hmi_scripts[@]}"; do
  node --check "HMI_NX/$source"
done
node --check HMI_NX/server/reference.cjs
node --check HMI_NX/server/provision.cjs
node --test HMI_NX/tests/*.test.cjs
mkdir -p "$output_dir/HMI_NX"
for source in index.html style.css "${hmi_scripts[@]}"; do
  cp "HMI_NX/$source" "$output_dir/HMI_NX/$source"
done

# HMI NX ST is a separate experimental editor. It does not replace HMI_NX.
hmi_st_scripts=(expressions.js model.js sysmac-types.js runtime.js st.js zip.js history.js app.js)
for source in "${hmi_st_scripts[@]}"; do
  node --check "HMI_NX_ST/$source"
done
node --test HMI_NX_ST/tests/*.test.cjs
mkdir -p "$output_dir/HMI_NX_ST"
for source in index.html style.css "${hmi_st_scripts[@]}"; do
  cp "HMI_NX_ST/$source" "$output_dir/HMI_NX_ST/$source"
done
# Separate online alternative. Copy only the public client, never server sources.
python3 HMI_NX/online/tool/build.py "$output_dir/HMI_NX_Online"

# Fingerprint editor scripts/styles so browsers cannot keep the pre-NX-Retain
# recipe editor in their cache after a Pages deployment.
python3 - "$output_dir/HMI_NX_ST" "$output_dir/HMI_NX_Online" <<'PY_VERSIONED_ASSETS'
import hashlib
import re
import sys
from pathlib import Path

asset_re = re.compile(r'(\b(?:src|href)=")([A-Za-z0-9_.-]+\.(?:js|css))(")')
for target in map(Path, sys.argv[1:]):
    page = target / "index.html"
    html = page.read_text(encoding="utf-8")
    def fingerprint(match):
        asset = target / match.group(2)
        if not asset.is_file():
            raise SystemExit(f"Missing WebHMI asset: {asset}")
        token = hashlib.sha256(asset.read_bytes()).hexdigest()[:12]
        return f"{match.group(1)}{match.group(2)}?v={token}{match.group(3)}"
    html, total = asset_re.subn(fingerprint, html)
    if total < 5:
        raise SystemExit(f"Expected editor assets for {target}, found {total}")
    page.write_text(html, encoding="utf-8")
    print(f"{target}: fingerprinted {total} editor assets")
PY_VERSIONED_ASSETS

node --test HMI_NX/online/test/*.test.cjs
# Catch missing JS dependencies in both published editors before Pages deployment.
node scripts/verify_webhmi_bundle.cjs "$output_dir"

mkdir -p "$output_dir/assets/config"
cp assets/InduRadarLogoVertical-600.webp "$output_dir/assets/"
cp assets/InduRadarLogoVertical-128.webp "$output_dir/assets/"
cp assets/InduRadar_Informe_Demo_Anonimizado_Flexografia.pdf "$output_dir/assets/"
cp assets/config/induradar_credits_v1.json "$output_dir/assets/config/"
cp -R web/privacidad "$output_dir/privacidad"
cp web/CNAME web/favicon.png web/manifest.json "$output_dir/"
cp site/robots.txt site/sitemap.xml "$output_dir/"
cp -R web/icons "$output_dir/icons"

# Keep the current static form implementation untouched while adding the SFP2
# research-objective selector as a small pre-module bootstrap. It patches only
# the lead payload and leaves contact/other JSON requests unchanged.
INDEX_HTML="$output_dir/index.html" node - <<'NODE'
const fs = require('node:fs');

const indexPath = process.env.INDEX_HTML;
const marker = '  <script type="module" src="app.js"></script>';
const bootstrap = '  <script src="research-objective.js"></script>\n';
const html = fs.readFileSync(indexPath, 'utf8');

if (!html.includes(marker)) {
  throw new Error(`Missing script marker in ${indexPath}`);
}

fs.writeFileSync(indexPath, html.replace(marker, `${bootstrap}${marker}`));
NODE

config_json="$(LEAD_ENDPOINT="$lead_endpoint" CONTACT_ENDPOINT="$contact_endpoint" REPORT_ENDPOINT="$report_endpoint" SUPABASE_URL="$supabase_url" SUPABASE_PUBLISHABLE_KEY="$supabase_publishable_key" node -e 'process.stdout.write(JSON.stringify({leadEndpoint: process.env.LEAD_ENDPOINT, contactEndpoint: process.env.CONTACT_ENDPOINT, reportEndpoint: process.env.REPORT_ENDPOINT, supabaseUrl: process.env.SUPABASE_URL, supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY}))')"
printf 'window.INDURADAR_CONFIG = Object.freeze(%s);\n' "$config_json" > "$output_dir/config.js"
rm "$output_dir/config.template.js"
rm "$output_dir/package.json"

