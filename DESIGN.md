---
name: TV Home
description: A cinematic, remote-controlled television home screen.
colors:
  ground: "#101112"
  surface: "#202122"
  text: "#f5f5f3"
  muted: "#bfc0c0"
  focus: "#fafaf8"
typography:
  clock:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "184px"
    fontWeight: 300
    lineHeight: 1
    letterSpacing: "-0.04em"
  section:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "23px"
    fontWeight: 550
    lineHeight: 1.5
    letterSpacing: "-0.4px"
  body:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  artwork: "16px"
  control: "12px"
spacing:
  tv-edge: "88px"
  tile-gutter: "24px"
  label-gap: "16px"
components:
  app-art:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.artwork}"
    height: "122px"
  action-button:
    backgroundColor: "{colors.text}"
    textColor: "{colors.ground}"
    rounded: "{rounded.control}"
    padding: "22px 24px"
---

## Overview

The user chose a cinematic scenic wallpaper, large clock, and quiet app dock. This is a television launcher viewed from a couch, often in a dim room. The photograph supplies atmosphere; standard remote navigation supplies predictability. Build directly in HTML/CSS/vanilla JavaScript within Chromium 76's limits.

## Colors

Use charcoal surfaces under warm white text. App marks retain recognition colors, but the tile surfaces remain neutral. Selected artwork becomes white with a separate white outline. A neutral photographic scrim protects legibility; there are no decorative gradients or glass panels.

## Typography

Inter is bundled locally. The clock uses light tabular numerals at 184px on the TV viewport. Date text is 27px, section labels 23px, app labels 20px, and secondary information 14–17px. Smaller desktop previews deliberately reduce scale. Short app labels may truncate visually, while the complete name remains in the button's accessible label.

## Layout

At 1920×1080 use 88px equal side gutters. The brand and settings anchor the top corners; clock and date lead on the left. App and website rows occupy the lower screen. Six app tiles use `(available width − 5 × 24px) / 6`; additional device apps scroll inside the row. At short desktop heights compact the clock and artwork to preserve breathing room. Narrow previews show three app tiles at a time and scroll vertically.

## Elevation & Depth

Surface lightness establishes depth. The settings panel uses a flat scrim behind it. Only transient toast feedback has an offset shadow.

## Shapes

App artwork uses 16px corners. Website and action controls use 12px corners. The settings shortcut is a small pill. SVG supplies geometric interface icons; textual W/BBC marks identify websites.

## Components

Focus is immediate: 4px white outlines, a 5–6px offset, and a small app-art scale. App labels stay outside the transformed artwork, preserving the navigation grid's geometry. Keyboard actions have no animation delay. Reduced motion removes scale feedback. Settings traps navigation and restores the original tile on close.

## Do's and Don'ts

Preserve the remote keys, original app IDs, desktop mocks, saved preferences, editable tiles, and idle mode. Bundle images and fonts locally and retain their credits. Weather comes from Open-Meteo, with cached readings explicitly marked offline when necessary. Do not add motion libraries, blur effects, fake watch history, invented weather, or capabilities the TV cannot support. Verify on the actual television before claiming device compatibility.
