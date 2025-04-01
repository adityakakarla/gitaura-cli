# GitGenie

A command-line tool that helps you create backdated git commits and populate your GitHub contribution graph.

## Installation

```bash
npm install -g gitgenie
```

## Features

- Create a new GitHub repository or use an existing one
- Generate multiple backdated commits across any date range
- Evenly distribute commits throughout the selected period
- Automatically push commits to GitHub

## Usage

Run directly with npx:

```bash
npx gitgenie
```

The tool will:
1. Ask where you want to create your repository (defaults to ~/gitgenie)
2. Create the directory if it doesn't exist
3. Set up a Git repository via GitHub
4. Create backdated commits based on your specified date range
5. Push the commits to GitHub

Don't worry–it will not do anything without your confirmation.

## Requirements

- Node.js
- Git installed locally
- GitHub CLI (gh) installed for easier repository creation (optional)