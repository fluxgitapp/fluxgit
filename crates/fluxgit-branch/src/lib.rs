mod reference_ext;
pub use reference_ext::{ReferenceExt, ReferenceExtGix};
mod dedup;
pub use dedup::dedup;
mod branch;
pub use branch::{BranchCreateRequest, BranchIdentity, BranchUpdateRequest};
use lazy_static::lazy_static;
lazy_static! {
    pub static ref FLUXGIT_WORKSPACE_REFERENCE: fluxgit_reference::LocalRefname =
        fluxgit_reference::LocalRefname::new("fluxgit/workspace", None);
}
