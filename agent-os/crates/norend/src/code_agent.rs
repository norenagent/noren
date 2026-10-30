//! Code agent: an LLM writes a small Python program plus tests, the program
//! runs in an isolated workspace, and the test output is fed back to the model
//! for a bounded number of repair rounds.
//!
//! The model never gets a shell. It can only propose file contents; the daemon
//! decides what runs (a fixed entrypoint inside the sandbox preset). Everything
//! here is pure logic over two traits so it is testable without Docker or a
//! network: [`noren_llm::Provider`] for the model and [`CodeExecutor`] for
//! the sandbox.

use async_trait::async_trait;
use noren_llm::{ChatMessage, Provider};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// File types the agent may produce. Python runs in the sandbox; the web files
/// are only ever returned as text for a locked-down preview, never executed by
/// the daemon host. Anything else (shell, php, svg, binaries) is refused.
const ALLOWED_EXTENSIONS: [&str; 4] = [".py", ".html", ".css", ".js"];

/// Output ceiling requested from the model. Up to 6 files of 12 KB each can
/// exceed the 4096-token defaults, which cut a site off mid-JSON.
const AGENT_MAX_OUTPUT_TOKENS: u32 = 8192;

/// Hard limits. The agent is a public surface, so every dimension is bounded.
pub const MAX_ROUNDS: usize = 4;
pub const MAX_FILES: usize = 6;
pub const MAX_FILE_BYTES: usize = 12 * 1024;
pub const MAX_TASK_CHARS: usize = 600;
/// Model replies larger than this are rejected before parsing.
pub const MAX_REPLY_BYTES: usize = 64 * 1024;
/// Feedback sent back to the model is clipped so a noisy run cannot blow up the
/// prompt (and the bill).
pub const MAX_FEEDBACK_CHARS: usize = 3000;

/// What the sandbox reports for one execution of the proposed files.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExecutionReport {
    pub stdout: String,
    pub stderr: String,
    /// `true` when the program exited 0 (all tests passed).
    pub passed: bool,
}

#[async_trait]
pub trait CodeExecutor: Send + Sync {
    /// Run `files` (name -> contents) and report. Implementations decide the
    /// sandbox; a platform failure (timeout, busy, runtime missing) is `Err`.
    async fn execute(&self, files: &BTreeMap<String, String>) -> Result<ExecutionReport, String>;
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RoundTrace {
    pub round: usize,
    pub files: Vec<String>,
    pub passed: bool,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum AgentOutcome {
    /// Tests passed. `files` is the final program.
    Passed { files: BTreeMap<String, String> },
    /// Rounds exhausted without a passing run. Best attempt is returned.
    Failed { files: BTreeMap<String, String> },
    /// The model replied with something unusable on every attempt.
    BadModelOutput { reason: String },
    /// The sandbox itself failed (busy, timeout, runtime missing).
    SandboxError { reason: String },
    /// The model provider failed or the spend cap was hit.
    ModelError { reason: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentRun {
    pub outcome: AgentOutcome,
    pub rounds: Vec<RoundTrace>,
}

const SYSTEM_PROMPT: &str = "You are a careful engineer. Reply with ONLY a JSON object, no prose, no markdown fences. \
Shape: {\"files\": {\"main.py\": \"...\", \"solution.py\": \"...\"}}. \
Rules: Python 3.12 standard library only; no network; no third-party packages; no pip. \
`main.py` is the entrypoint and MUST run the checks itself and finish with `unittest.main()` \
(put the solution in `solution.py` and import it, or define it in main.py). It must import what it tests. \
Exit code 0 means every check passed. At most 6 files, each under 12 KB. Allowed file names end in \
.py, .html, .css or .js. Docstrings must describe what the code really does. The program may only write inside /workspace. \
WEBSITES: when asked for a page or site, `index.html` and `style.css` (and `app.js` only if needed) must be \
real entries of the \"files\" object, written out in full, exactly like main.py. Never build the page inside \
Python code or return it from a function: the viewer shows only the files you list. `main.py` then opens \
those files from /workspace and checks them. \
It is shown in a locked-down preview: no external requests, so no CDN links, no web fonts, no remote images, \
no external scripts; everything inline or in your own files, link the stylesheet as style.css. Make it responsive \
and good looking. Because a browser cannot run here, `main.py` must verify the site with `html.parser` from the \
standard library: assert the doctype, a title, that every id or class used by CSS or JS exists, that links point \
to files you created, and that there are no external URLs. Keep it small and deterministic.";

/// Validate and normalise a file map from the model. Names must be a single safe
/// path component ending in `.py`; this mirrors the runner's own check so a bad
/// name is a model error we can feed back, not a platform error.
pub fn validate_files(files: &BTreeMap<String, String>) -> Result<(), String> {
    if files.is_empty() {
        return Err("no files".into());
    }
    if files.len() > MAX_FILES {
        return Err(format!("too many files (max {MAX_FILES})"));
    }
    if !files.contains_key("main.py") {
        return Err("missing main.py".into());
    }
    for (name, body) in files {
        let ok_name = name.len() <= 64
            && ALLOWED_EXTENSIONS
                .iter()
                .any(|ext| name.len() > ext.len() && name.ends_with(ext))
            && name
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.'))
            && !name.contains("..");
        if !ok_name {
            return Err(format!("invalid file name {name:?}"));
        }
        if body.len() > MAX_FILE_BYTES {
            return Err(format!("{name} exceeds {MAX_FILE_BYTES} bytes"));
        }
        if body.trim().is_empty() {
            return Err(format!("{name} is empty"));
        }
    }
    Ok(())
}

/// Extract the `files` object from a model reply. Tolerates a markdown fence or
/// stray prose around a single JSON object, but never executes anything.
pub fn parse_model_reply(reply: &str) -> Result<BTreeMap<String, String>, String> {
    if reply.len() > MAX_REPLY_BYTES {
        return Err("reply too large".into());
    }
    let start = reply.find('{').ok_or("no JSON object in reply")?;
    let end = reply.rfind('}').ok_or("no JSON object in reply")?;
    if end < start {
        return Err("malformed JSON object".into());
    }
    #[derive(Deserialize)]
    struct Reply {
        files: BTreeMap<String, String>,
    }
    let parsed: Reply =
        serde_json::from_str(&reply[start..=end]).map_err(|e| format!("invalid JSON: {e}"))?;
    validate_files(&parsed.files)?;
    Ok(parsed.files)
}

fn clip(text: &str, max: usize) -> String {
    if text.chars().count() <= max {
        return text.to_string();
    }
    let head: String = text.chars().take(max).collect();
    format!("{head}\n…[clipped]")
}

fn feedback(report: &ExecutionReport) -> String {
    let status = if report.passed { "PASSED" } else { "FAILED" };
    format!(
        "Run result: {status}.\n--- stdout ---\n{}\n--- stderr ---\n{}\nFix the problems and reply with the full JSON object again.",
        clip(&report.stdout, MAX_FEEDBACK_CHARS),
        clip(&report.stderr, MAX_FEEDBACK_CHARS)
    )
}

/// Run the write -> execute -> repair loop.
pub async fn run_code_agent(
    task: &str,
    provider: &dyn Provider,
    executor: &dyn CodeExecutor,
    max_rounds: usize,
) -> AgentRun {
    let rounds_cap = max_rounds.clamp(1, MAX_ROUNDS);
    let mut traces: Vec<RoundTrace> = Vec::new();
    let task: String = task.chars().take(MAX_TASK_CHARS).collect();
    let mut messages = vec![
        ChatMessage::system(SYSTEM_PROMPT),
        ChatMessage::user(format!("Task: {task}")),
    ];
    let mut best: Option<BTreeMap<String, String>> = None;
    let mut bad_streak = 0usize;

    // `attempt` counts model calls (bounded by rounds_cap); `executed` counts
    // real sandbox runs and is what callers see as the round number, so a
    // rejected reply never leaves a gap in the numbering.
    let mut executed = 0usize;
    for attempt in 1..=rounds_cap {
        let reply = match provider.complete(&messages).await {
            Ok(text) => text,
            Err(error) => {
                return AgentRun {
                    outcome: AgentOutcome::ModelError {
                        reason: error.to_string(),
                    },
                    rounds: traces,
                };
            }
        };
        let files = match parse_model_reply(&reply) {
            Ok(files) => {
                bad_streak = 0;
                files
            }
            Err(reason) => {
                bad_streak += 1;
                if bad_streak >= 2 || attempt == rounds_cap {
                    return AgentRun {
                        outcome: AgentOutcome::BadModelOutput { reason },
                        rounds: traces,
                    };
                }
                messages.push(ChatMessage::assistant(clip(&reply, 800)));
                messages.push(ChatMessage::user(format!(
                    "Your reply was rejected: {reason}. Reply with ONLY the JSON object."
                )));
                continue;
            }
        };
        best = Some(files.clone());
        let report = match executor.execute(&files).await {
            Ok(report) => report,
            Err(reason) => {
                return AgentRun {
                    outcome: AgentOutcome::SandboxError { reason },
                    rounds: traces,
                };
            }
        };
        executed += 1;
        traces.push(RoundTrace {
            round: executed,
            files: files.keys().cloned().collect(),
            passed: report.passed,
            stdout: clip(&report.stdout, MAX_FEEDBACK_CHARS),
            stderr: clip(&report.stderr, MAX_FEEDBACK_CHARS),
        });
        if report.passed {
            return AgentRun {
                outcome: AgentOutcome::Passed { files },
                rounds: traces,
            };
        }
        messages.push(ChatMessage::assistant(reply));
        messages.push(ChatMessage::user(feedback(&report)));
    }
    AgentRun {
        outcome: match best {
            Some(files) => AgentOutcome::Failed { files },
            None => AgentOutcome::BadModelOutput {
                reason: "no usable attempt".into(),
            },
        },
        rounds: traces,
    }
}

/// Wraps a provider with a hard cap on model calls per UTC day, shared by every
/// caller of the daemon. It caps calls, not dollars: the provider trait does not
/// expose token usage, so the real cost bound is `calls x max_tokens` of the
/// configured model.
pub struct CappedProvider {
    inner: Box<dyn Provider>,
    daily_calls: u64,
    state: std::sync::Mutex<(u64, u64)>, // (utc day number, calls used)
    now_day: fn() -> u64,
}

fn utc_day() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() / 86_400)
        .unwrap_or(0)
}

impl CappedProvider {
    pub fn new(inner: Box<dyn Provider>, daily_calls: u64) -> Self {
        Self {
            inner,
            daily_calls,
            state: std::sync::Mutex::new((0, 0)),
            now_day: utc_day,
        }
    }

    #[cfg(test)]
    fn with_clock(mut self, now_day: fn() -> u64) -> Self {
        self.now_day = now_day;
        self
    }

    /// Reserve one call. `false` means today's budget is spent.
    fn try_take(&self) -> bool {
        let today = (self.now_day)();
        let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        if state.0 != today {
            *state = (today, 0);
        }
        if state.1 >= self.daily_calls {
            return false;
        }
        state.1 += 1;
        true
    }
}

#[async_trait]
impl Provider for CappedProvider {
    fn name(&self) -> &'static str {
        self.inner.name()
    }
    async fn complete(&self, messages: &[ChatMessage]) -> Result<String, noren_llm::ProviderError> {
        if !self.try_take() {
            return Err(noren_llm::ProviderError::Status {
                status: 429,
                body: "daily model-call budget is spent".into(),
            });
        }
        self.inner.complete(messages).await
    }
}

/// Build the agent's model from the daemon's own environment. Never from a
/// request. `None` means the agent is not configured.
///
/// `NOREN_AGENT_PROVIDER` = anthropic | openai | deepseek,
/// `NOREN_AGENT_API_KEY`, optional `NOREN_AGENT_MODEL`,
/// `NOREN_AGENT_DAILY_CALLS` (default 120).
pub fn agent_provider_from_env() -> Option<CappedProvider> {
    let provider = std::env::var("NOREN_AGENT_PROVIDER").ok()?;
    let key = std::env::var("NOREN_AGENT_API_KEY")
        .ok()
        .filter(|k| !k.trim().is_empty())?;
    let model = std::env::var("NOREN_AGENT_MODEL")
        .ok()
        .filter(|m| !m.trim().is_empty());
    let calls = std::env::var("NOREN_AGENT_DAILY_CALLS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(120);
    let inner: Box<dyn Provider> = match provider.trim() {
        "anthropic" => Box::new(
            noren_llm::AnthropicProvider::new(
                key,
                model.unwrap_or_else(|| "claude-haiku-4-5".into()),
            )
            .with_max_tokens(AGENT_MAX_OUTPUT_TOKENS),
        ),
        "openai" => Box::new(
            noren_llm::OpenAiProvider::openai(key, model.unwrap_or_else(|| "gpt-4o-mini".into()))
                .with_max_tokens(AGENT_MAX_OUTPUT_TOKENS),
        ),
        "deepseek" => Box::new(
            noren_llm::OpenAiProvider::deepseek(
                key,
                model.unwrap_or_else(|| "deepseek-chat".into()),
            )
            .with_max_tokens(AGENT_MAX_OUTPUT_TOKENS),
        ),
        _ => return None,
    };
    Some(CappedProvider::new(inner, calls))
}

/// Runs the agent's files in the same gVisor `python-run` workspace a person
/// would use. Failures of the *program* (non-zero exit, timeout) are normal
/// results the model can fix; only platform failures are errors.
pub struct DockerCodeExecutor {
    pub runtime: String,
}

#[async_trait]
impl CodeExecutor for DockerCodeExecutor {
    async fn execute(&self, files: &BTreeMap<String, String>) -> Result<ExecutionReport, String> {
        use noren_runtime::{DockerWorkspaceRun, DockerWorkspaceRunner, RunnerError};
        let slots = crate::workspace_slots();
        let Ok(_permit) = slots.try_acquire() else {
            return Err("workspace is busy; try again shortly".into());
        };
        let mut run =
            DockerWorkspaceRun::new("noren-python-run:latest", ["/usr/local/bin/python-run"])
                .with_limits(
                    1.0,
                    128 * 1024 * 1024,
                    32,
                    std::time::Duration::from_secs(10),
                );
        for (name, body) in files {
            run = run.with_file(name.clone(), body.as_bytes().to_vec());
        }
        let runner = DockerWorkspaceRunner::new()
            .with_disk_limit_mb(8)
            .with_runtime(&self.runtime);
        match runner.run(&run).await {
            Ok(result) => Ok(ExecutionReport { stdout: result.stdout, stderr: result.stderr, passed: true }),
            Err(RunnerError::WorkspaceExit { stdout, stderr, .. }) => Ok(ExecutionReport { stdout, stderr, passed: false }),
            Err(RunnerError::Timeout(_)) => Ok(ExecutionReport {
                stdout: String::new(),
                stderr: "The program ran longer than 10 seconds and was stopped. Avoid infinite loops and heavy work.".into(),
                passed: false,
            }),
            Err(_) => Err("workspace run failed".into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use noren_llm::ProviderError;
    use std::sync::Mutex;

    /// Provider that replays scripted replies and records what it was asked.
    struct Script {
        replies: Mutex<Vec<String>>,
        seen: Mutex<Vec<Vec<ChatMessage>>>,
    }
    impl Script {
        fn new(replies: &[&str]) -> Self {
            Self {
                replies: Mutex::new(replies.iter().rev().map(|s| s.to_string()).collect()),
                seen: Mutex::new(Vec::new()),
            }
        }
    }
    #[async_trait]
    impl Provider for Script {
        fn name(&self) -> &'static str {
            "script"
        }
        async fn complete(&self, messages: &[ChatMessage]) -> Result<String, ProviderError> {
            self.seen.lock().unwrap().push(messages.to_vec());
            self.replies
                .lock()
                .unwrap()
                .pop()
                .ok_or_else(|| ProviderError::Empty)
        }
    }

    /// Executor that passes only when a marker string is present in main.py.
    struct MarkerExecutor {
        marker: &'static str,
        calls: Mutex<usize>,
    }
    #[async_trait]
    impl CodeExecutor for MarkerExecutor {
        async fn execute(
            &self,
            files: &BTreeMap<String, String>,
        ) -> Result<ExecutionReport, String> {
            *self.calls.lock().unwrap() += 1;
            let ok = files
                .get("main.py")
                .is_some_and(|b| b.contains(self.marker));
            Ok(ExecutionReport {
                stdout: if ok { "OK".into() } else { "running".into() },
                stderr: if ok {
                    String::new()
                } else {
                    "AssertionError: wrong answer".into()
                },
                passed: ok,
            })
        }
    }

    fn reply(main: &str) -> String {
        serde_json::json!({ "files": { "main.py": main } }).to_string()
    }

    #[tokio::test]
    async fn repairs_after_a_failing_run_and_feeds_the_failure_back_to_the_model() {
        let provider = Script::new(&[&reply("print('bad')"), &reply("print('GOOD')")]);
        let executor = MarkerExecutor {
            marker: "GOOD",
            calls: Mutex::new(0),
        };
        let run = run_code_agent("add numbers", &provider, &executor, 4).await;

        assert!(
            matches!(run.outcome, AgentOutcome::Passed { .. }),
            "{:?}",
            run.outcome
        );
        assert_eq!(run.rounds.len(), 2);
        assert!(!run.rounds[0].passed && run.rounds[1].passed);
        let seen = provider.seen.lock().unwrap();
        let second_prompt = &seen[1];
        let last = &second_prompt.last().unwrap().content;
        assert!(
            last.contains("FAILED") && last.contains("AssertionError"),
            "{last}"
        );
    }

    #[tokio::test]
    async fn round_numbers_count_real_executions_even_after_a_rejected_reply() {
        // Reply 1 is unusable JSON (retried, never executed). Reply 2 runs and
        // fails. Reply 3 runs and passes. The two executions must be reported as
        // rounds 1 and 2, so the numbering matches "rounds used".
        let provider = Script::new(&[
            "not json at all",
            &reply("print('bad')"),
            &reply("print('GOOD')"),
        ]);
        let executor = MarkerExecutor {
            marker: "GOOD",
            calls: Mutex::new(0),
        };
        let run = run_code_agent("t", &provider, &executor, 4).await;
        assert!(
            matches!(run.outcome, AgentOutcome::Passed { .. }),
            "{:?}",
            run.outcome
        );
        let numbers: Vec<usize> = run.rounds.iter().map(|r| r.round).collect();
        assert_eq!(
            numbers,
            vec![1, 2],
            "round labels must be consecutive executions"
        );
    }

    #[tokio::test]
    async fn stops_at_the_round_cap_and_returns_the_best_attempt() {
        let provider = Script::new(&[
            &reply("a=1"),
            &reply("a=2"),
            &reply("a=3"),
            &reply("a=4"),
            &reply("a=5"),
        ]);
        let executor = MarkerExecutor {
            marker: "NEVER",
            calls: Mutex::new(0),
        };
        let run = run_code_agent("impossible", &provider, &executor, 3).await;
        assert!(matches!(run.outcome, AgentOutcome::Failed { .. }));
        assert_eq!(*executor.calls.lock().unwrap(), 3, "exactly 3 sandbox runs");
        assert_eq!(
            provider.seen.lock().unwrap().len(),
            3,
            "exactly 3 model calls"
        );
    }

    #[tokio::test]
    async fn round_cap_can_never_exceed_the_hard_limit() {
        let many: Vec<String> = (0..20).map(|i| reply(&format!("a={i}"))).collect();
        let refs: Vec<&str> = many.iter().map(|s| s.as_str()).collect();
        let provider = Script::new(&refs);
        let executor = MarkerExecutor {
            marker: "NEVER",
            calls: Mutex::new(0),
        };
        let _ = run_code_agent("x", &provider, &executor, 1000).await;
        assert_eq!(*executor.calls.lock().unwrap(), MAX_ROUNDS);
    }

    #[tokio::test]
    async fn garbage_replies_end_as_bad_model_output_without_touching_the_sandbox() {
        let provider = Script::new(&["I cannot do that.", "still not json"]);
        let executor = MarkerExecutor {
            marker: "x",
            calls: Mutex::new(0),
        };
        let run = run_code_agent("t", &provider, &executor, 4).await;
        assert!(
            matches!(run.outcome, AgentOutcome::BadModelOutput { .. }),
            "{:?}",
            run.outcome
        );
        assert_eq!(*executor.calls.lock().unwrap(), 0);
    }

    #[tokio::test]
    async fn sandbox_failure_is_reported_as_such_and_stops_the_loop() {
        struct Broken;
        #[async_trait]
        impl CodeExecutor for Broken {
            async fn execute(
                &self,
                _f: &BTreeMap<String, String>,
            ) -> Result<ExecutionReport, String> {
                Err("workspace is busy".into())
            }
        }
        let provider = Script::new(&[&reply("print(1)"), &reply("print(2)")]);
        let run = run_code_agent("t", &provider, &Broken, 4).await;
        assert_eq!(
            run.outcome,
            AgentOutcome::SandboxError {
                reason: "workspace is busy".into()
            }
        );
        assert_eq!(
            provider.seen.lock().unwrap().len(),
            1,
            "no extra model spend after a sandbox failure"
        );
    }

    #[tokio::test]
    async fn provider_error_stops_the_loop_as_model_error() {
        let provider = Script::new(&[]);
        let executor = MarkerExecutor {
            marker: "x",
            calls: Mutex::new(0),
        };
        let run = run_code_agent("t", &provider, &executor, 4).await;
        assert!(matches!(run.outcome, AgentOutcome::ModelError { .. }));
    }

    #[test]
    fn model_reply_parsing_tolerates_fences_and_rejects_unsafe_names() {
        let fenced = format!("```json\n{}\n```", reply("print(1)"));
        assert!(parse_model_reply(&fenced).is_ok());

        for bad in [
            "../x.py",
            "/etc/passwd",
            "a/b.py",
            "x.sh",
            ".py",
            "a b.py",
            "",
        ] {
            let body = serde_json::json!({ "files": { "main.py": "print(1)", bad: "print(2)" } })
                .to_string();
            assert!(
                parse_model_reply(&body).is_err(),
                "{bad:?} must be rejected"
            );
        }
        let no_main = serde_json::json!({ "files": { "solution.py": "x=1" } }).to_string();
        assert!(parse_model_reply(&no_main).is_err());
        let big = serde_json::json!({ "files": { "main.py": "x".repeat(MAX_FILE_BYTES + 1) } })
            .to_string();
        assert!(parse_model_reply(&big).is_err());
        let make = |n: usize| -> BTreeMap<String, String> {
            (0..n)
                .map(|i| {
                    (
                        if i == 0 {
                            "main.py".to_string()
                        } else {
                            format!("f{i}.py")
                        },
                        "x=1".to_string(),
                    )
                })
                .collect()
        };
        assert!(
            validate_files(&make(MAX_FILES)).is_ok(),
            "exactly the limit is fine"
        );
        assert!(
            validate_files(&make(MAX_FILES + 1)).is_err(),
            "one over the limit is refused"
        );
    }

    #[test]
    fn website_files_are_allowed_but_nothing_that_could_execute_or_escape() {
        let mut site: BTreeMap<String, String> = BTreeMap::new();
        site.insert("main.py".into(), "print(1)".into());
        site.insert(
            "index.html".into(),
            "<!doctype html><title>x</title>".into(),
        );
        site.insert("style.css".into(), "body{margin:0}".into());
        site.insert("app.js".into(), "console.log(1)".into());
        assert!(validate_files(&site).is_ok(), "{:?}", validate_files(&site));

        for bad in [
            "x.sh",
            "x.php",
            "x.svg",
            "x.exe",
            "x.html.sh",
            "x",
            ".html",
            ".css",
            "../a.html",
            "a/b.html",
            "a b.html",
        ] {
            let mut files = BTreeMap::new();
            files.insert("main.py".to_string(), "print(1)".to_string());
            files.insert(bad.to_string(), "x".to_string());
            assert!(validate_files(&files).is_err(), "{bad:?} must be rejected");
        }
        // A site still needs main.py, because that is what the sandbox runs to
        // check it.
        let mut no_main = BTreeMap::new();
        no_main.insert("index.html".to_string(), "<p>hi</p>".to_string());
        assert!(validate_files(&no_main).is_err());
    }

    #[test]
    fn system_prompt_teaches_the_website_contract() {
        for needle in [
            "index.html",
            "html.parser",
            "no external",
            "style.css",
            "real entries",
            "never build the page",
        ] {
            assert!(
                SYSTEM_PROMPT
                    .to_lowercase()
                    .contains(&needle.to_lowercase()),
                "prompt must mention {needle:?}"
            );
        }
    }

    #[test]
    fn feedback_is_clipped_so_noisy_runs_cannot_inflate_the_prompt() {
        let noisy = ExecutionReport {
            stdout: "A".repeat(100_000),
            stderr: String::new(),
            passed: false,
        };
        assert!(feedback(&noisy).chars().count() < 2 * MAX_FEEDBACK_CHARS + 400);
    }

    #[tokio::test]
    async fn capped_provider_stops_at_the_daily_budget_and_resets_next_day() {
        use std::sync::atomic::{AtomicU64, Ordering};
        static DAY: AtomicU64 = AtomicU64::new(100);
        fn clock() -> u64 {
            DAY.load(Ordering::SeqCst)
        }
        let inner = Script::new(&["a", "b", "c", "d"]);
        let capped = CappedProvider::new(Box::new(inner), 2).with_clock(clock);
        let msgs = [ChatMessage::user("x")];
        assert!(capped.complete(&msgs).await.is_ok());
        assert!(capped.complete(&msgs).await.is_ok());
        let spent = capped.complete(&msgs).await.unwrap_err();
        assert!(
            matches!(spent, ProviderError::Status { status: 429, .. }),
            "{spent:?}"
        );
        DAY.store(101, Ordering::SeqCst);
        assert!(
            capped.complete(&msgs).await.is_ok(),
            "a new UTC day restores the budget"
        );
    }

    #[test]
    fn agent_provider_requires_provider_and_key_and_rejects_unknown_names() {
        // Env is process-global; run the scenarios sequentially in one test.
        for k in [
            "NOREN_AGENT_PROVIDER",
            "NOREN_AGENT_API_KEY",
            "NOREN_AGENT_MODEL",
            "NOREN_AGENT_DAILY_CALLS",
        ] {
            std::env::remove_var(k);
        }
        assert!(agent_provider_from_env().is_none(), "nothing configured");
        std::env::set_var("NOREN_AGENT_PROVIDER", "anthropic");
        assert!(agent_provider_from_env().is_none(), "key missing");
        std::env::set_var("NOREN_AGENT_API_KEY", "   ");
        assert!(agent_provider_from_env().is_none(), "blank key");
        std::env::set_var("NOREN_AGENT_API_KEY", "k");
        assert!(agent_provider_from_env().is_some());
        std::env::set_var("NOREN_AGENT_PROVIDER", "mock");
        assert!(
            agent_provider_from_env().is_none(),
            "mock must never be selectable in production"
        );
        for k in ["NOREN_AGENT_PROVIDER", "NOREN_AGENT_API_KEY"] {
            std::env::remove_var(k);
        }
    }

    /// Real sandbox, scripted model: proves the loop works end to end through
    /// Docker + gVisor. Run with `-- --ignored` on a host with the runtime.
    #[tokio::test]
    #[ignore = "live: needs Docker, the runsc runtime and the noren-python-run:latest image"]
    async fn live_agent_repairs_a_failing_program_inside_the_real_sandbox() {
        let broken = serde_json::json!({ "files": {
            "solution.py": "def add(a, b):\n    return a - b\n",
            "main.py": "import unittest\nfrom solution import add\n\nclass T(unittest.TestCase):\n    def test_add(self):\n        self.assertEqual(add(2, 3), 5)\n\nunittest.main()\n"
        }}).to_string();
        let fixed = serde_json::json!({ "files": {
            "solution.py": "def add(a, b):\n    return a + b\n",
            "main.py": "import unittest\nfrom solution import add\n\nclass T(unittest.TestCase):\n    def test_add(self):\n        self.assertEqual(add(2, 3), 5)\n\nunittest.main()\n"
        }}).to_string();
        let provider = Script::new(&[&broken, &fixed]);
        let executor = DockerCodeExecutor {
            runtime: "runsc".into(),
        };
        let run = run_code_agent("write add(a,b)", &provider, &executor, 3).await;
        assert!(
            matches!(run.outcome, AgentOutcome::Passed { .. }),
            "{:?}",
            run
        );
        assert_eq!(run.rounds.len(), 2);
        assert!(!run.rounds[0].passed);
        assert!(
            run.rounds[0].stderr.contains("AssertionError"),
            "{}",
            run.rounds[0].stderr
        );
        assert!(run.rounds[1].passed);
    }
}
