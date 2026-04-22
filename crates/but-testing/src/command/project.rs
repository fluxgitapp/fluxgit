use std::path::PathBuf;

use anyhow::{Context as _, Result};
use but_ctx::Context;
use but_settings::AppSettings;
use fluxgit_reference::RemoteRefname;

use crate::command::debug_print;

pub fn add(data_dir: PathBuf, path: PathBuf, refname: Option<RemoteRefname>) -> Result<()> {
    let path = gix::discover(path)?
        .workdir()
        .context("Only non-bare repositories can be added")?
        .to_owned()
        .canonicalize()?;
    let outcome = fluxgit_project::add_at_app_data_dir(data_dir, path)?;
    let project = outcome.try_project()?;

    let mut ctx = Context::new_from_legacy_project_and_settings(&project, AppSettings::default());
    if let Some(refname) = refname {
        let mut guard = ctx.exclusive_worktree_access();
        fluxgit_branch_actions::set_base_branch(&ctx, &refname, guard.write_permission())?;
    };
    debug_print(project)
}

pub fn remove(project_name: &str) -> Result<()> {
    let projects = fluxgit_project::dangerously_list_projects_without_migration()?;
    let project = projects
        .into_iter()
        .find(|p| p.title == project_name)
        .context("Project not found")?;
    fluxgit_project::delete(project.id)
}
