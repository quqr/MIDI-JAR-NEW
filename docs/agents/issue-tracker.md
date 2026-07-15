# Issue Tracker

## Overview

This project uses **GitHub Issues** as the primary issue tracker.

**Repository:** [quqr/MIDI-JAR-NEW](https://github.com/quqr/MIDI-JAR-NEW/issues)

## Creating Issues

Use the `gh` CLI to create issues:

```bash
gh issue create --repo quqr/MIDI-JAR-NEW --title "Issue title" --body "Description"
```

## Listing Issues

```bash
gh issue list --repo quqr/MIDI-JAR-NEW
```

## Viewing Issues

```bash
gh issue view <number> --repo quqr/MIDI-JAR-NEW
```

## Closing Issues

```bash
gh issue close <number> --repo quqr/MIDI-JAR-NEW
```

## Labels

Default GitHub labels are used. Custom labels can be added via the GitHub UI or CLI.

## Pull Requests as Issue Surface

**Disabled.** Pull requests are not treated as issues in the triage queue. To enable this, set `prs-as-issues: true` and re-run setup.
