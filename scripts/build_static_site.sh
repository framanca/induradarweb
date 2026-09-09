#!/usr/bin/env bash

set -euo pipefail

output_dir="${1:-build/static}"
lead_endpoint="${LEAD_ENDPOINT:-}"
contact_endpoint="${CONTACT_ENDPOINT:-}"

rm -rf "$output_dir"
mkdir -p "$output_dir"

cp -R site/. "$output_dir/"
mkdir -p "$output_dir/assets/config"
cp assets/InduRadarLogoVertical-600.webp "$output_dir/assets/"
cp assets/InduRadarLogoVertical-128.webp "$output_dir/assets/"
cp assets/InduRadar_Informe_Demo_Anonimizado_Flexografia.pdf "$output_dir/assets/"
cp assets/config/induradar_credits_v1.json "$output_dir/assets/config/"
cp -R web/privacidad "$output_dir/privacidad"
cp web/CNAME web/favicon.png web/manifest.json web/robots.txt web/sitemap.xml "$output_dir/"
cp -R web/icons "$output_dir/icons"

config_json="$(LEAD_ENDPOINT="$lead_endpoint" CONTACT_ENDPOINT="$contact_endpoint" node -e 'process.stdout.write(JSON.stringify({leadEndpoint: process.env.LEAD_ENDPOINT, contactEndpoint: process.env.CONTACT_ENDPOINT}))')"
printf 'window.INDURADAR_CONFIG = Object.freeze(%s);\n' "$config_json" > "$output_dir/config.js"
rm "$output_dir/config.template.js"
rm "$output_dir/package.json"
