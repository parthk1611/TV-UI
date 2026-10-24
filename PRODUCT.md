# TV Home

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users and purpose

A personal home screen for the user's Samsung QN65Q60AAFXZC (Q60A, 2021), used from the couch with the TV remote. Read the time, open installed apps, and reach website shortcuts without a mouse.

## Stack and constraints

Plain HTML/CSS/JavaScript, ES2019 maximum, no build step. Target Tizen 6.0 / Chromium 76 and verify layout at 1920×1080. Keep application ID `TvHome0001.TVHome`, package `TvHome0001`, and signing identity stable. Discover installed apps; never treat example IDs as verified. Desktop launches and exit are mocks. Arrows, Enter, Back and Red must work with visible focus. Avoid expensive motion and partner-only privileges.

## Current scope

Step 1 has a live clock/date, installed-app API guards, desktop sample apps, website preview feedback, and a settings shell. Weather, editable/persisted settings, website opening and idle mode remain later milestones. No TV deployment is verified.

## Confirmed direction

The user selected cinematic scenic wallpaper, a large clock, and a quiet app dock. Dark theme is part of the original brief. The October 24 redesign changes presentation while retaining existing interactions and honest preview states.
