# Infinite Factory OS

This repository contains the design exports from Claude Design for the Infinite Factory OS command centre.

## Contents
- `Home Health.html` — main dashboard / health view
- `Content Pipeline.html` — workflow pipeline view
- `Content Review.html` — content review interface
- `brief.txt` — project brief
- `ios-frame.jsx` — design component file

## Notes
- This repo is a static design reference, not a React application.
- Open the HTML files in a browser to view the design screens.

## Delivery Runner
- `workers/lead-magnet-delivery-runner` — proof-mode Cloudflare Worker for lead magnet delivery validation and controlled sends.
- `.github/workflows/deploy-lead-magnet-delivery-runner-preview.yml` — preview-only GitHub Actions deploy path using the `workers-preview` environment.
