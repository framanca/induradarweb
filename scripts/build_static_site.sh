#!/usr/bin/env bash

set -euo pipefail

output_dir="${1:-build/static}"
lead_endpoint="${LEAD_ENDPOINT:-}"
contact_endpoint="${CONTACT_ENDPOINT:-}"
report_endpoint="${REPORT_ENDPOINT:-}"

rm -rf "$output_dir"
mkdir -p "$output_dir"

cp -R site/. "$output_dir/"
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

config_json="$(LEAD_ENDPOINT="$lead_endpoint" CONTACT_ENDPOINT="$contact_endpoint" REPORT_ENDPOINT="$report_endpoint" node -e 'process.stdout.write(JSON.stringify({leadEndpoint: process.env.LEAD_ENDPOINT, contactEndpoint: process.env.CONTACT_ENDPOINT, reportEndpoint: process.env.REPORT_ENDPOINT}))')"
printf 'window.INDURADAR_CONFIG = Object.freeze(%s);\n' "$config_json" > "$output_dir/config.js"
rm "$output_dir/config.template.js"
rm "$output_dir/package.json"
