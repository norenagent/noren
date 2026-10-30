//! Live AceData smoke test. Spends real credits — run by hand:
//!
//!   NOREN_ACEDATA_API_KEY=... \
//!     cargo run -p noren-acedata --example live_smoke
//!
//! Hits the cheap SERP endpoint through the registered search tool and
//! prints the raw result plus the provenance record. Kept out of the
//! unit suite so CI never spends credits.

use std::sync::Arc;

use noren_acedata::config::BASE_URL;
use noren_acedata::{acedata_tools, AceDataClient, AceDataConfig};
use noren_mcp::Content;
use serde_json::json;

#[tokio::main]
async fn main() {
    let key = std::env::var("NOREN_ACEDATA_API_KEY")
        .expect("set NOREN_ACEDATA_API_KEY to run the live smoke test");
    let client = Arc::new(AceDataClient::new(BASE_URL, key));
    let cfg = AceDataConfig {
        enabled: true,
        allow: Some(vec!["acedata.search".to_string()]),
        ..Default::default()
    };
    let search = acedata_tools(client, &cfg)
        .into_iter()
        .next()
        .expect("search tool registered");

    let res = search
        .call(json!({ "query": "noren agent operating system" }))
        .await
        .expect("search call failed");

    println!("is_error: {}", res.is_error);
    for block in res.content {
        match block {
            Content::Json { value } => {
                println!("{}", serde_json::to_string_pretty(&value).unwrap());
            }
            Content::Text { text } => println!("{text}"),
        }
    }
}
