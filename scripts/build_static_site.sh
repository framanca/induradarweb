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

# HMI NX is isolated from the InduRadar portal and has no cloud/backend dependency.
# Publish only static editor modules: never provisioned users, service state or policies.
hmi_modules=(core.js model.js service.js data.js widgets.js transport.js runtime.js exporter.js panels.js app.js)
for source in "${hmi_modules[@]}"; do
  node --check "HMI_NX/$source"
done
node --test HMI_NX/tests/*.test.cjs
mkdir -p "$output_dir/HMI_NX"
for source in index.html style.css "${hmi_modules[@]}"; do
  cp "HMI_NX/$source" "$output_dir/HMI_NX/$source"
done

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
