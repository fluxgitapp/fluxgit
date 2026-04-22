fn main() {
    let identifier = if let Ok(channel) = std::env::var("CHANNEL") {
        match channel.as_str() {
            "nightly" => "com.fluxgit.app.nightly",
            "release" => "com.fluxgit.app",
            _ => "com.fluxgit.app.dev",
        }
    } else {
        "com.fluxgit.app.dev"
    };
    println!("cargo:rustc-env=IDENTIFIER={identifier}");
}
