#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');
const inquirer = require('inquirer');

function isGitHubCLIAvailable() {
  try {
    execSync('gh --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

function isGitHubAuthenticated() {
  try {
    execSync('gh auth status', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

function isGitRepo() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

function hasGitOrigin() {
  try {
    const output = execSync('git remote get-url origin', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

function getGitOriginUrl() {
  try {
    return execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
  } catch (error) {
    return null;
  }
}

function createBackdatedCommit(date) {
  const timestamp = date.toISOString();
  const fileName = `commit_${Date.now()}_${Math.floor(Math.random() * 10000)}.txt`;
  
  fs.writeFileSync(fileName, `Backdated commit: ${timestamp}`);
  
  execSync(`git add ${fileName}`, { stdio: 'ignore' });
  
  const commitEnv = {
    GIT_AUTHOR_DATE: timestamp,
    GIT_COMMITTER_DATE: timestamp
  };
  
  execSync(`git commit -m "Commit for ${date.toDateString()}"`, { 
    env: { ...process.env, ...commitEnv },
    stdio: 'ignore'
  });
}

function distributeCommits(startDate, endDate, totalCommits) {
  const daysBetween = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  if (daysBetween <= 0) {
    throw new Error('End date must be after start date');
  }
  
  const dateArray = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dateArray.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  const commitMap = {};
  dateArray.forEach(date => {
    commitMap[date.toDateString()] = 0;
  });
  
  for (let i = 0; i < totalCommits; i++) {
    const randomIndex = Math.floor(Math.random() * dateArray.length);
    const dateKey = dateArray[randomIndex].toDateString();
    commitMap[dateKey]++;
  }
  
  return commitMap;
}

async function setupGitRepo() {
  let repoUrl = null;
  
  const isRepo = isGitRepo();
  const hasOrigin = isRepo && hasGitOrigin();
  
  if (hasOrigin) {
    console.log('Git repository with origin already exists.');
    repoUrl = getGitOriginUrl();
    console.log(`Using existing origin: ${repoUrl}`);
    return repoUrl;
  }
  
  const ghAvailable = isGitHubCLIAvailable();
  const ghAuthenticated = ghAvailable && isGitHubAuthenticated();
  
  if (ghAuthenticated) {
    console.log('GitHub CLI detected and authenticated!');

    let repoCreated = false;
    while (!repoCreated) {
      const repoAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'repoName',
          message: 'Enter a name for your new GitHub repository:',
          default: path.basename(process.cwd()),
        },
        {
          type: 'confirm',
          name: 'isPrivate',
          message: 'Should the repository be private?',
          default: true,
        }
      ]);
      
      try {
        const repoExists = execSync(`gh repo view ${repoAnswer.repoName}`, { stdio: 'pipe' });
        console.log(`Repository ${repoAnswer.repoName} already exists. Using the existing repository.`);
        repoCreated = true;
        repoUrl = execSync(`gh repo view ${repoAnswer.repoName} --json url -q .url`, { encoding: 'utf8' }).trim() + '.git';
      } catch (error) {
        console.log(`Creating GitHub repository: ${repoAnswer.repoName}...`);
        const visibility = repoAnswer.isPrivate ? '--private' : '--public';
        
        try {
          execSync(`gh repo create ${repoAnswer.repoName} ${visibility}`, { stdio: 'inherit' });
          repoCreated = true;
          repoUrl = execSync(`gh repo view ${repoAnswer.repoName} --json url -q .url`, { encoding: 'utf8' }).trim() + '.git';
        } catch (error) {
          console.error('Failed to create repository:', error.message);
          if (error.message.includes('Name already exists on this account')) {
            console.log('A repository with that name already exists. Please try a different name.');
          } else {
            throw error;
          }
        }
      }
    }
  } else {
    if (ghAvailable) {
      console.log('GitHub CLI detected but not authenticated. Please run "gh auth login" separately and try again or create a Github repo and enter the URL.');
    } else {
      console.log('GitHub CLI not detected. Using manual repository URL entry.');
    }
    
    const repoAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'githubRepo',
        message: 'Enter your GitHub repository URL (e.g., https://github.com/username/repo):',
        validate: input => {
          if (!input || !input.match(/github\.com\/[\w-]+\/[\w-]+/)) {
            return 'Please enter a valid GitHub repository URL';
          }
          return true;
        },
        filter: input => {
          if (!input.endsWith('.git')) {
            return input.endsWith('/') ? `${input.slice(0, -1)}.git` : `${input}.git`;
          }
          return input;
        }
      }
    ]);
    
    repoUrl = repoAnswer.githubRepo;
  }
  
  if (!isRepo) {
    console.log('Initializing git repository...');
    execSync('git init', { stdio: 'inherit' });
  }
  
  console.log('Adding GitHub remote repository...');
  if (hasOrigin) {
    execSync(`git remote set-url origin ${repoUrl}`, { stdio: 'inherit' });
  } else {
    execSync(`git remote add origin ${repoUrl}`, { stdio: 'inherit' });
  }
  
  console.log('Git repository initialized successfully!');
  console.log(`GitHub remote added: ${repoUrl}`);
  
  return repoUrl;
}

async function createBackdatedCommits() {
  const dateFormat = /^\d{4}-\d{2}-\d{2}$/;
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'startDate',
      message: 'Enter the start date for your commits (YYYY-MM-DD):',
      validate: input => {
        if (!dateFormat.test(input) || isNaN(new Date(input).getTime())) {
          return 'Please enter a valid date in YYYY-MM-DD format';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'endDate',
      message: 'Enter the end date for your commits (YYYY-MM-DD):',
      validate: input => {
        if (!dateFormat.test(input) || isNaN(new Date(input).getTime())) {
          return 'Please enter a valid date in YYYY-MM-DD format';
        }
        return true;
      }
    },
    {
      type: 'number',
      name: 'commitCount',
      message: 'How many commits do you want to create?',
      validate: input => {
        if (isNaN(input) || input <= 0 || !Number.isInteger(Number(input))) {
          return 'Please enter a positive integer';
        }
        return true;
      }
    }
  ]);
  
  const startDate = new Date(answers.startDate);
  const endDate = new Date(answers.endDate);
  const commitCount = parseInt(answers.commitCount);
  
  console.log('Distributing commits across date range...');
  const commitMap = distributeCommits(startDate, endDate, commitCount);
  
  console.log('Creating backdated commits:');
  
  const sortedDates = Object.keys(commitMap)
    .map(dateStr => new Date(dateStr))
    .sort((a, b) => a - b);
  
  for (const date of sortedDates) {
    const numCommits = commitMap[date.toDateString()];
    if (numCommits > 0) {
      console.log(`- Creating ${numCommits} commit(s) for ${date.toDateString()}`);
      
      for (let i = 0; i < numCommits; i++) {
        createBackdatedCommit(date);
      }
    }
  }
  
  console.log('All commits created successfully!');
  
  const shouldPush = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'push',
      message: 'Push commits to GitHub?',
      default: true,
    }
  ]);
  
  if (shouldPush.push) {
    console.log('Pushing commits to GitHub...');
    execSync('git push -u origin HEAD', { stdio: 'inherit' });
    console.log('Commits pushed successfully!');
  }
}

async function main() {
  try {
    const homeDir = os.homedir();
    const defaultDir = path.join(homeDir, 'gitaura');

    const dirAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'directory',
        message: 'Where would you like to create your repository?',
        default: defaultDir,
      }
    ]);
    
    const targetDir = dirAnswer.directory;
    
    if (!fs.existsSync(targetDir)) {
      console.log(`Creating directory: ${targetDir}`);
      fs.mkdirSync(targetDir, { recursive: true });
    } else {
      console.log(`Directory already exists: ${targetDir}`);
    }
    
    process.chdir(targetDir);
    console.log(`Changed to directory: ${targetDir}`);

    await setupGitRepo();
    await createBackdatedCommits();
    
  } catch (error) {
    console.error('An error occurred:', error.message);
    process.exit(1);
  }
}

main();
