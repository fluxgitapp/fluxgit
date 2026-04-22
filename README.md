<div align="center">
  
  <img align="center" width="100px" src="https://fluxgit-docs-images-public.s3.us-east-1.amazonaws.com/md-logo.png" alt="FluxGit logo" />
  <br />

  <h1 align="center">FluxGit</h1>
  
  <p align="center">
   <b>Git, <i>but</i> better</b>.
   <br/>
   FluxGit is a modern Git-based version control interface with both a GUI and CLI built from the ground up for AI-powered workflows.
    <br />
    <br />
    <a href="https://fluxgit.com">Website</a>
  <br/>

FluxGit is a powerful new Git-based version control system, designed from scratch to be simple, powerful and flexible. It is designed for ease of use and modern agentic workflows.

It features stacked branches, parallel branches, unlimited undo, easy commit mutations, forge integrations and more.

Works instantly in any existing Git repo as a friendlier and more powerful drop-in Git user interface replacement - for you and your agents.

## Main Features

Why use FluxGit instead of vanilla Git? What a great question.

- **Stacked Branches** ([gui](https://docs.fluxgit.com/features/branch-management/stacked-branches), [cli](https://docs.fluxgit.com/cli-guides/cli-tutorial/branching-and-commiting#stacked-branches))
  - Effortlessly create branches stacked on other branches. Amend or edit any commit easily with automatic restacking.
- **Parallel Branches** ([gui](https://docs.fluxgit.com/features/branch-management/virtual-branches), [cli](https://docs.fluxgit.com/cli-guides/cli-tutorial/branching-and-commiting#parallel-branches))
  - Organize work on multiple branches simultaneously, rather than constantly switching branches.
- **Easy Commit Management** ([gui](https://docs.fluxgit.com/features/branch-management/commits), [cli](https://docs.fluxgit.com/cli-guides/cli-tutorial/rubbing))
  - Uncommit, reword, amend, move, split and squash commits by dragging and dropping or simple CLI commands. Forget about `rebase -i`, you don't need it anymore.
- **Undo Timeline** ([gui](https://docs.fluxgit.com/features/timeline), [cli](https://docs.fluxgit.com/cli-guides/cli-tutorial/operations-log))
  - Logs all operations and changes and allows you to easily undo or revert any operation.
- **First Class Conflicts** ([gui](https://docs.fluxgit.com/overview#conflicting-branches), [cli](https://docs.fluxgit.com/cli-guides/cli-tutorial/conflict-resolution))
  - Rebases always succeed. Commits can be marked as conflicted and resolved at any time, in any order.
- **Forge Integration** ([gui](https://docs.fluxgit.com/features/forge-integration/github-integration), [cli](https://docs.fluxgit.com/cli-guides/cli-tutorial/forges))
  - Authenticate to GitHub or GitLab to easily open and update Pull Requests, list branches, get CI statuses and more. No other tools required.
- **AI Tooling** ([gui](https://docs.fluxgit.com/features/ai-integration/ai-overview), [cli](https://docs.fluxgit.com/cli-guides/cli-tutorial/ai-stuff))
  - Use built-in AI handlers to help create commit messages, branch names, PR descriptions and more.
  - Easily install hooks or skills for all modern agent systems to level up their Git management.

## Tech

The FluxGit desktop app is a [Tauri](https://tauri.app/)-based application. Its UI is written in [Svelte](https://svelte.dev/) using [TypeScript](https://www.typescriptlang.org) and its backend is written in [Rust](https://www.rust-lang.org/).

The `but` CLI is the same Rust backend engine with a Rust command line UI.

## License

