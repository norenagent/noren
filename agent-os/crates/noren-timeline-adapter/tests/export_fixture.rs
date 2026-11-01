use std::process::Command;

#[test]
fn exported_engineering_run_matches_the_offline_fixture() {
    let output = Command::new(env!("CARGO_BIN_EXE_noren-timeline-export-demo"))
        .output()
        .expect("run Noren Timeline exporter");
    assert!(
        output.status.success(),
        "exporter failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let actual: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("exporter emits JSON");
    let expected: serde_json::Value =
        serde_json::from_str(include_str!("fixtures/noren-engineering-run.json"))
            .expect("offline fixture is JSON");

    assert_eq!(actual, expected);
}
