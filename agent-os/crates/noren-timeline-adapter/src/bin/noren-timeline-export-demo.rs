use noren_ipc::Response;
use noren_timeline_adapter::{
    capability_receipt_event, capability_request, checkpoint_event, evidence_event,
    provenance_evidence_event, CapabilityTemplate, TimelineCommand, TimelineRun,
};
use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Source {
    run_id: String,
    contract: Value,
    observations: Vec<Observation>,
}

#[derive(Deserialize)]
struct Observation {
    id: String,
    kind: String,
    producer: String,
    claims: Vec<String>,
    checkpoint: String,
    payload: Value,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let source: Source = serde_json::from_str(include_str!(
        "../../tests/fixtures/engineering-evidence.json"
    ))?;
    let mut run = TimelineRun::new(source.run_id.clone(), source.contract)?;

    for observation in source.observations {
        let sequence = run.events.len() as u64;
        let evidence = if observation.kind == "noren.provenance" {
            provenance_evidence_event(
                sequence,
                observation.id.clone(),
                observation.claims,
                &observation.payload,
            )?
        } else {
            evidence_event(
                sequence,
                observation.id.clone(),
                observation.kind,
                observation.producer,
                observation.claims,
                &observation.payload,
            )?
        };
        run.push(evidence)?;
        run.push(checkpoint_event(
            run.events.len() as u64,
            observation.checkpoint,
            vec![observation.id],
            "noren.engineering.v0",
        )?)?;
    }

    let command = TimelineCommand {
        schema: "noren.timeline.command.v0alpha1".into(),
        id: format!("{}:release-ready:7", source.run_id),
        kind: "noren.capability.request".into(),
        payload_ref: "release.publish".into(),
        idempotency_key: format!("{}/release-ready/7", source.run_id),
        replay_policy: "forbid".into(),
    };
    let template = CapabilityTemplate {
        payload_ref: "release.publish".into(),
        action: "release.publish".into(),
        scope: Some(serde_json::json!({"repository": "norenagent/noren"})),
        expires_at: None,
    };
    let request = capability_request(&command, &template)?;
    let request: noren_ipc::Request = serde_json::from_value(serde_json::to_value(request)?)?;
    assert!(matches!(
        request,
        noren_ipc::Request::GrantCapability { .. }
    ));

    let response = Response::CapabilityGranted {
        signature_b58: "GrantSigRelease".into(),
        subject_display: "operator@noren".into(),
        action: "release.publish".into(),
    };
    run.push(capability_receipt_event(
        run.events.len() as u64,
        &command,
        &template,
        &response,
    )?)?;

    println!("{}", serde_json::to_string_pretty(&run)?);
    Ok(())
}
