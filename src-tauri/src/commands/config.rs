use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

fn hermes_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_default().join(".hermes")
}

fn config_path() -> PathBuf {
    hermes_dir().join("config.yaml")
}

pub(crate) fn env_path() -> PathBuf {
    hermes_dir().join(".env")
}

fn zshrc_path() -> PathBuf {
    dirs::home_dir().unwrap_or_default().join(".zshrc")
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HermesConfig {
    #[serde(default = "default_provider")]
    pub provider: String,
    #[serde(default = "default_model")]
    pub model: String,
    #[serde(default = "default_backend")]
    pub backend: String,
    #[serde(default = "default_memory_limit")]
    pub memory_limit_mb: u32,
    #[serde(default = "default_true")]
    pub persistent_memory: bool,
    #[serde(default = "default_true")]
    pub auto_skill_generation: bool,
    #[serde(default)]
    pub command_approval: bool,
    #[serde(default = "default_true")]
    pub budget_warning: bool,
    #[serde(default = "default_language")]
    pub language: String,
}

fn default_provider() -> String { "openrouter".into() }
fn default_model() -> String { "anthropic/claude-sonnet-4-5".into() }
fn default_backend() -> String { "local".into() }
fn default_memory_limit() -> u32 { 5120 }
fn default_true() -> bool { true }
fn default_language() -> String { "system".into() }

impl Default for HermesConfig {
    fn default() -> Self {
        Self {
            provider: default_provider(),
            model: default_model(),
            backend: default_backend(),
            memory_limit_mb: default_memory_limit(),
            persistent_memory: true,
            auto_skill_generation: true,
            command_approval: false,
            budget_warning: true,
            language: default_language(),
        }
    }
}

impl HermesConfig {
    pub fn load_from(path: &Path) -> Result<Self, String> {
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = std::fs::read_to_string(path)
            .map_err(|e| format!("Failed to read config: {e}"))?;

        // Parse as raw Value to tolerate nested structures we don't own
        let raw: serde_yaml::Value = serde_yaml::from_str(&content)
            .map_err(|e| format!("Failed to parse config YAML: {e}"))?;

        let mut cfg = Self::default();

        // model can be a plain string OR a map like { default: "...", provider: "..." }
        match raw.get("model") {
            Some(serde_yaml::Value::String(s)) => cfg.model = s.clone(),
            Some(serde_yaml::Value::Mapping(m)) => {
                if let Some(serde_yaml::Value::String(s)) =
                    m.get("default").or_else(|| m.get("model"))
                {
                    cfg.model = s.clone();
                }
                // provider inside model map takes priority if present
                if let Some(serde_yaml::Value::String(p)) = m.get("provider") {
                    if p != "auto" {
                        cfg.provider = p.clone();
                    }
                }
            }
            _ => {}
        }

        // Top-level provider (overrides model.provider if set)
        if let Some(serde_yaml::Value::String(s)) = raw.get("provider") {
            cfg.provider = s.clone();
        }

        // Flat boolean / numeric fields
        if let Some(v) = raw.get("persistent_memory").or_else(|| raw.get("persistentMemory")) {
            if let Some(b) = v.as_bool() { cfg.persistent_memory = b; }
        }
        if let Some(v) = raw.get("auto_skill_generation").or_else(|| raw.get("autoSkillGeneration")) {
            if let Some(b) = v.as_bool() { cfg.auto_skill_generation = b; }
        }
        if let Some(v) = raw.get("command_approval").or_else(|| raw.get("commandApproval")) {
            if let Some(b) = v.as_bool() { cfg.command_approval = b; }
        }
        if let Some(v) = raw.get("budget_warning").or_else(|| raw.get("budgetWarning")) {
            if let Some(b) = v.as_bool() { cfg.budget_warning = b; }
        }
        if let Some(v) = raw.get("memory_limit_mb").or_else(|| raw.get("memoryLimitMb")) {
            if let Some(n) = v.as_u64() { cfg.memory_limit_mb = n as u32; }
        }
        if let Some(serde_yaml::Value::String(s)) = raw.get("backend") {
            cfg.backend = s.clone();
        }
        if let Some(serde_yaml::Value::String(s)) = raw.get("language") {
            cfg.language = s.clone();
        }

        Ok(cfg)
    }

    pub fn save_to(&self, path: &Path) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config dir: {e}"))?;
        }

        let content = if path.exists() {
            std::fs::read_to_string(path)
                .map_err(|e| format!("Failed to read config: {e}"))?
        } else {
            String::new()
        };

        let updated = patch_model_fields(&content, &self.provider, &self.model);
        std::fs::write(path, updated)
            .map_err(|e| format!("Failed to write config: {e}"))
    }
}

// ── Text-based model field patcher ───────────────────────────
//
// Operates on raw YAML text so that comments, blank lines, and every
// other section are completely untouched.  Only the `provider:` and
// `default:` lines inside the *last* top-level `model:` block are
// updated (or inserted if absent).  No YAML parse-serialize cycle.

fn yaml_indent(line: &str) -> &str {
    let n = line.len() - line.trim_start_matches([' ', '\t']).len();
    &line[..n]
}

fn escape_yaml_string(s: &str) -> String {
    s.replace('"', "\\\"")
}

fn is_top_level_model_key(line: &str) -> bool {
    if line.starts_with(' ') || line.starts_with('\t') {
        return false;
    }
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return false;
    }
    let (key, _) = match trimmed.split_once(':') {
        Some(parts) => parts,
        None => return false,
    };
    key.trim() == "model"
}

fn tighten_env_permissions(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let permissions = std::fs::Permissions::from_mode(0o600);
        std::fs::set_permissions(path, permissions)
            .map_err(|e| format!("Failed to set .env permissions: {e}"))?;
    }
    Ok(())
}

fn patch_model_fields(content: &str, provider: &str, model: &str) -> String {
    let mut lines: Vec<String> = content.lines().map(String::from).collect();
    let n = lines.len();
    let trailing_newline = content.ends_with('\n');

    // Find the *last* top-level `model:` line (unindented, not a comment)
    let mut model_idx: Option<usize> = None;
    for (i, line) in lines.iter().enumerate() {
        if is_top_level_model_key(line) {
            model_idx = Some(i);
        }
    }

    let model_idx = match model_idx {
        Some(idx) => idx,
        None => {
            // No model: block — append a minimal one
            lines.push("model:".into());
            lines.push(format!("  provider: {}", provider));
            lines.push(format!("  default: \"{}\"", escape_yaml_string(model)));
            let mut out = lines.join("\n");
            if trailing_newline { out.push('\n'); }
            return out;
        }
    };

    // Scan forward through the block (indented lines + blank lines until a
    // non-indented, non-blank line that isn't a top-level comment).
    let mut found_provider = false;
    let mut found_default  = false;
    let mut i = model_idx + 1;
    while i < n {
        let line = &lines[i];
        let is_indented = line.starts_with(' ') || line.starts_with('\t');
        let is_blank    = line.trim().is_empty();

        if !is_indented && !is_blank {
            break; // left the block
        }

        if is_indented {
            let trimmed = line.trim();
            if !trimmed.starts_with('#') {
                if trimmed.starts_with("provider:") {
                    lines[i] = format!("{}provider: {}", yaml_indent(line), provider);
                    found_provider = true;
                } else if trimmed.starts_with("default:") || trimmed.starts_with("model:") {
                    lines[i] = format!("{}default: \"{}\"", yaml_indent(line), escape_yaml_string(model));
                    found_default = true;
                }
            }
        }
        i += 1;
    }

    // Insert any missing fields right after the `model:` line
    let insert_at = model_idx + 1;
    if !found_default {
        lines.insert(insert_at, format!("  default: \"{}\"", escape_yaml_string(model)));
    }
    if !found_provider {
        lines.insert(insert_at, format!("  provider: {}", provider));
    }

    let mut out = lines.join("\n");
    if trailing_newline { out.push('\n'); }
    out
}

// ── Tauri commands ────────────────────────────────────────────

#[tauri::command]
pub async fn get_config() -> Result<HermesConfig, String> {
    HermesConfig::load_from(&config_path())
}

#[tauri::command]
pub async fn save_config(config: HermesConfig) -> Result<(), String> {
    config.save_to(&config_path())
}

fn env_key_for_provider(provider: &str) -> &'static str {
    match provider.trim().to_lowercase().as_str() {
        "nvidia" => "NVIDIA_API_KEY",
        "openrouter" => "OPENROUTER_API_KEY",
        "openai" => "OPENAI_API_KEY",
        "anthropic" => "ANTHROPIC_API_KEY",
        "google" | "gemini" => "GEMINI_API_KEY",
        _ => "LLM_API_KEY",
    }
}

fn env_line_key(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return None;
    }
    let (left, _) = trimmed.split_once('=')?;
    Some(left.trim().to_string())
}

pub(crate) fn read_env_value(path: &Path, key: &str) -> Option<String> {
    let content = std::fs::read_to_string(path).ok()?;
    for line in content.lines() {
        if let Some(current_key) = env_line_key(line) {
            if current_key.eq_ignore_ascii_case(key) {
                let (_, value) = line.split_once('=')?;
                let raw = value.trim();
                let unquoted = if raw.len() >= 2
                    && ((raw.starts_with('"') && raw.ends_with('"'))
                        || (raw.starts_with('\'') && raw.ends_with('\'')))
                {
                    &raw[1..raw.len() - 1]
                } else {
                    raw
                };
                return Some(unquoted.to_string());
            }
        }
    }
    None
}

fn upsert_env_value(lines: &mut Vec<String>, key: &str, value: &str) {
    lines.retain(|line| match env_line_key(line) {
        Some(current_key) => !current_key.eq_ignore_ascii_case(key),
        None => true,
    });
    lines.push(format!("{}={}", key, value));
}

pub(crate) fn save_wechat_login_to_env(
    env_path: &Path,
    account_id: &str,
    token: &str,
    base_url: &str,
    user_id: &str,
) -> Result<(), String> {
    let existing = if env_path.exists() {
        std::fs::read_to_string(env_path).map_err(|e| format!("Failed to read .env: {e}"))?
    } else {
        String::new()
    };

    let mut lines: Vec<String> = existing.lines().map(String::from).collect();
    upsert_env_value(&mut lines, "WEIXIN_ACCOUNT_ID", account_id.trim());
    upsert_env_value(&mut lines, "WEIXIN_TOKEN", token.trim());
    upsert_env_value(&mut lines, "WEIXIN_BASE_URL", base_url.trim());
    upsert_env_value(&mut lines, "WEIXIN_HOME_CHANNEL", user_id.trim());

    if read_env_value(env_path, "WEIXIN_CDN_BASE_URL").is_none() {
        upsert_env_value(
            &mut lines,
            "WEIXIN_CDN_BASE_URL",
            "https://novac2c.cdn.weixin.qq.com/c2c",
        );
    }

    let global_allow_all = read_env_value(env_path, "GATEWAY_ALLOW_ALL_USERS")
        .map(|v| v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    if read_env_value(env_path, "WEIXIN_ALLOW_ALL_USERS").is_none() {
        upsert_env_value(
            &mut lines,
            "WEIXIN_ALLOW_ALL_USERS",
            if global_allow_all { "true" } else { "false" },
        );
    }

    if read_env_value(env_path, "WEIXIN_DM_POLICY").is_none() {
        upsert_env_value(
            &mut lines,
            "WEIXIN_DM_POLICY",
            if global_allow_all { "open" } else { "pairing" },
        );
    }
    if read_env_value(env_path, "WEIXIN_GROUP_POLICY").is_none() {
        upsert_env_value(&mut lines, "WEIXIN_GROUP_POLICY", "open");
    }
    if read_env_value(env_path, "WEIXIN_ALLOWED_USERS").is_none() {
        upsert_env_value(&mut lines, "WEIXIN_ALLOWED_USERS", "");
    }
    if read_env_value(env_path, "WEIXIN_GROUP_ALLOWED_USERS").is_none() {
        upsert_env_value(&mut lines, "WEIXIN_GROUP_ALLOWED_USERS", "");
    }

    if let Some(parent) = env_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {e}"))?;
    }

    let content = lines.join("\n") + "\n";
    std::fs::write(env_path, content).map_err(|e| format!("Failed to write .env: {e}"))
}

fn ensure_nvidia_shell_block() -> Result<(), String> {
    let zshrc = zshrc_path();
    let existing = std::fs::read_to_string(&zshrc).unwrap_or_default();
    let begin = "# >>> hermeshelper nvidia runtime >>>";
    let end = "# <<< hermeshelper nvidia runtime <<<";

    let block = [
        begin,
        "# Keep Hermes NVIDIA /model validation stable in interactive shells.",
        "if [[ -f \"/etc/ssl/cert.pem\" ]]; then",
        "  export SSL_CERT_FILE=\"/etc/ssl/cert.pem\"",
        "fi",
        "if [[ -f \"$HOME/.hermes/.env\" ]]; then",
        "  _hermes_nvidia_key=\"$(grep '^NVIDIA_API_KEY=' \"$HOME/.hermes/.env\" | head -1 | cut -d= -f2-)\"",
        "  _hermes_nvidia_key=\"${_hermes_nvidia_key#\"}\"",
        "  _hermes_nvidia_key=\"${_hermes_nvidia_key%\"}\"",
        "  _hermes_nvidia_key=\"${_hermes_nvidia_key#\'}\"",
        "  _hermes_nvidia_key=\"${_hermes_nvidia_key%\'}\"",
        "  if [[ -n \"$_hermes_nvidia_key\" ]]; then",
        "    export NVIDIA_API_KEY=\"$_hermes_nvidia_key\"",
        "  fi",
        "  unset _hermes_nvidia_key",
        "fi",
        end,
    ]
    .join("\n");

    if let Some((before, rest)) = existing.split_once(begin) {
        if let Some((_, after)) = rest.split_once(end) {
            let before = before.trim_end();
            let after = after.trim_start();
            let mut next = String::new();

            if !before.is_empty() {
                next.push_str(before);
                next.push_str("\n\n");
            }

            next.push_str(&block);

            if !after.is_empty() {
                next.push_str("\n\n");
                next.push_str(after);
            }

            if !next.ends_with('\n') {
                next.push('\n');
            }

            return std::fs::write(&zshrc, next)
                .map_err(|e| format!("Failed to update ~/.zshrc: {e}"));
        }
    }

    let mut next = existing;
    if !next.is_empty() && !next.ends_with('\n') {
        next.push('\n');
    }
    if !next.is_empty() {
        next.push('\n');
    }
    next.push_str(&block);
    next.push('\n');

    std::fs::write(&zshrc, next).map_err(|e| format!("Failed to update ~/.zshrc: {e}"))
}

#[tauri::command]
pub async fn save_api_key(provider: String, key: String) -> Result<(), String> {
    let trimmed_key = key.trim();
    if trimmed_key.is_empty() {
        return Err("API key is empty".into());
    }
    if trimmed_key.contains('\n') || trimmed_key.contains('\r') || trimmed_key.contains('\0') {
        return Err("API key contains invalid characters".into());
    }

    let target_key = env_key_for_provider(&provider);
    let path = env_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create .hermes dir: {e}"))?;
    }

    let existing = std::fs::read_to_string(&path).unwrap_or_default();
    let mut lines: Vec<String> = existing
        .lines()
        .filter(|line| {
            match env_line_key(line) {
                Some(current) => {
                    let normalized = current.to_uppercase();
                    normalized != target_key
                }
                None => true,
            }
        })
        .map(String::from)
        .collect();
    lines.push(format!("{}={}", target_key, trimmed_key));
    std::fs::write(&path, lines.join("\n") + "\n")
        .map_err(|e| format!("Failed to write .env: {e}"))?;
    tighten_env_permissions(&path)?;

    if provider.trim().eq_ignore_ascii_case("nvidia") {
        ensure_nvidia_shell_block()?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_api_key(provider: String) -> Result<Option<String>, String> {
    let path = env_path();
    if !path.exists() {
        return Ok(None);
    }

    let key = env_key_for_provider(&provider);
    Ok(read_env_value(&path, key))
}

#[tauri::command]
pub async fn remove_api_key(provider: String) -> Result<(), String> {
    let path = env_path();
    if !path.exists() {
        return Ok(());
    }

    let target_key = env_key_for_provider(&provider);
    let existing = std::fs::read_to_string(&path).unwrap_or_default();
    let filtered: Vec<String> = existing
        .lines()
        .filter(|line| match env_line_key(line) {
            Some(current) => !current.eq_ignore_ascii_case(target_key),
            None => true,
        })
        .map(String::from)
        .collect();

    std::fs::write(&path, filtered.join("\n") + "\n")
        .map_err(|e| format!("Failed to write .env: {e}"))?;
    tighten_env_permissions(&path)
}

/// Patch a single key:value inside the last top-level `model:` block using
/// text manipulation.  The rest of the file (comments, other sections) is
/// byte-for-byte unchanged.
fn patch_model_subfield(content: &str, key: &str, value: &str) -> String {
    let mut lines: Vec<String> = content.lines().map(String::from).collect();
    let n = lines.len();
    let trailing_newline = content.ends_with('\n');

    // Find last top-level `model:` line
    let mut model_idx: Option<usize> = None;
    for (i, line) in lines.iter().enumerate() {
        if is_top_level_model_key(line) {
            model_idx = Some(i);
        }
    }

    let model_idx = match model_idx {
        Some(idx) => idx,
        None => {
            lines.push("model:".into());
            lines.push(format!("  {}: \"{}\"", key, escape_yaml_string(value)));
            let mut out = lines.join("\n");
            if trailing_newline { out.push('\n'); }
            return out;
        }
    };

    let mut found = false;
    let mut i = model_idx + 1;
    while i < n {
        let line = &lines[i];
        let is_indented = line.starts_with(' ') || line.starts_with('\t');
        let is_blank    = line.trim().is_empty();
        if !is_indented && !is_blank { break; }
        if is_indented {
            let trimmed = line.trim().to_string();
            let indent = yaml_indent(line).to_string();
            if !trimmed.starts_with('#') && trimmed.starts_with(&format!("{}:", key)) {
                lines[i] = format!("{}{}: \"{}\"", indent, key, escape_yaml_string(value));
                found = true;
                break;
            }
        }
        i += 1;
    }

    if !found {
        lines.insert(model_idx + 1, format!("  {}: \"{}\"", key, escape_yaml_string(value)));
    }

    let mut out = lines.join("\n");
    if trailing_newline { out.push('\n'); }
    out
}

/// Append a `custom_providers:` list item if the provider (by name) is not already present.
/// The existing file content — including all comments in the block — is never touched.
fn ensure_custom_provider(content: &str, provider_name: &str, item_yaml: &str) -> String {
    // If both markers exist, the entry is already there — nothing to do.
    if content.contains("custom_providers:")
        && content.contains(&format!("name: {}", provider_name))
    {
        return content.to_string();
    }

    let trailing_newline = content.ends_with('\n');
    let mut lines: Vec<String> = content.lines().map(String::from).collect();

    if !content.contains("custom_providers:") {
        // No block yet — append a brand new one.
        if !lines.is_empty() {
            lines.push(String::new()); // blank separator line
        }
        lines.push("custom_providers:".into());
        for l in item_yaml.lines() {
            lines.push(l.to_string());
        }
    } else {
        // Block exists — find where it ends and insert the new item there.
        let custom_idx = lines
            .iter()
            .position(|l| l.trim_end() == "custom_providers:")
            .unwrap();
        let n = lines.len();
        let mut block_end = custom_idx + 1;
        while block_end < n {
            let l = &lines[block_end];
            if !l.starts_with(' ') && !l.starts_with('\t') && !l.trim().is_empty() {
                break;
            }
            block_end += 1;
        }
        // Insert item lines just before the next top-level section.
        let item_lines: Vec<String> = item_yaml.lines().map(String::from).collect();
        for (j, il) in item_lines.iter().enumerate() {
            lines.insert(block_end + j, il.clone());
        }
    }

    let mut out = lines.join("\n");
    if trailing_newline { out.push('\n'); }
    out
}

#[tauri::command]
pub async fn apply_provider_yaml_patch(patch_yaml: String) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config dir: {e}"))?;
    }

    let patch: serde_yaml::Value = serde_yaml::from_str(&patch_yaml)
        .map_err(|e| format!("Failed to parse patch YAML: {e}"))?;

    let mut content = if path.exists() {
        std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read config: {e}"))?
    } else {
        String::new()
    };

    // 1. Patch model sub-fields (text-based, preserves comments)
    if let Some(serde_yaml::Value::Mapping(model_fields)) = patch.get("model") {
        for (k, v) in model_fields {
            if let (serde_yaml::Value::String(key), serde_yaml::Value::String(val)) = (k, v) {
                content = patch_model_subfield(&content, key, val);
            }
        }
    }

    // 2. Ensure each custom_providers item exists (append-if-missing, text-based)
    if let Some(serde_yaml::Value::Sequence(items)) = patch.get("custom_providers") {
        for item in items {
            let name = match item.get("name").and_then(|v| v.as_str()) {
                Some(n) => n.to_string(),
                None => continue,
            };
            // Serialize only this one item (not the whole file) to build the list entry text.
            let raw = serde_yaml::to_string(item)
                .unwrap_or_default();
            let raw = raw.trim_start_matches("---\n").trim_start_matches("---").trim_start();
            // Indent as a YAML list item under custom_providers: (2-space indent + "- " prefix)
            let item_yaml: String = raw
                .lines()
                .enumerate()
                .map(|(i, l)| {
                    if i == 0 { format!("  - {}", l) } else { format!("    {}", l) }
                })
                .collect::<Vec<_>>()
                .join("\n");
            content = ensure_custom_provider(&content, &name, &item_yaml);
        }
    }

    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write config: {e}"))
}

#[tauri::command]
pub async fn test_api_connection(provider: String, key: String) -> Result<bool, String> {
    let known_providers = ["openrouter", "openai", "anthropic", "google", "custom", "nvidia"];
    if key.is_empty() {
        return Err("API key is empty".into());
    }
    if !known_providers.contains(&provider.as_str()) {
        return Err(format!("Unknown provider: {provider}"));
    }
    Ok(key.len() > 8)
}

#[tauri::command]
pub async fn get_system_locale() -> Result<String, String> {
    // Check common Unix/macOS locale environment variables in priority order
    for var in &["LC_ALL", "LC_CTYPE", "LANG"] {
        if let Ok(val) = std::env::var(var) {
            if !val.is_empty() && val != "C" && val != "POSIX" {
                return Ok(val);
            }
        }
    }
    Ok("en-US".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_load_nested_model_map() {
        // Simulates the real Hermes config.yaml structure
        let yaml = r#"
model:
  default: "anthropic/claude-opus-4.6"
  provider: "auto"
  temperature: 0.7
"#;
        let dir = tempdir().unwrap();
        let path = dir.path().join("config.yaml");
        std::fs::write(&path, yaml).unwrap();
        let cfg = HermesConfig::load_from(&path).unwrap();
        assert_eq!(cfg.model, "anthropic/claude-opus-4.6");
        // provider stays default when hermes uses "auto"
        assert_eq!(cfg.provider, "openrouter");
    }

    #[test]
    fn test_load_string_model() {
        let yaml = r#"
model: "openai/gpt-4o"
provider: "openai"
"#;
        let dir = tempdir().unwrap();
        let path = dir.path().join("config.yaml");
        std::fs::write(&path, yaml).unwrap();
        let cfg = HermesConfig::load_from(&path).unwrap();
        assert_eq!(cfg.model, "openai/gpt-4o");
        assert_eq!(cfg.provider, "openai");
    }

    #[test]
    fn test_default_config_roundtrip() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("config.yaml");
        let cfg = HermesConfig::default();
        cfg.save_to(&path).unwrap();
        let loaded = HermesConfig::load_from(&path).unwrap();
        assert_eq!(loaded.provider, "openrouter");
        assert!(loaded.persistent_memory);
        assert_eq!(loaded.language, "system");
    }

    #[test]
    fn test_load_nonexistent_returns_default() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("nonexistent.yaml");
        let cfg = HermesConfig::load_from(&path).unwrap();
        assert_eq!(cfg.provider, "openrouter");
        assert_eq!(cfg.language, "system");
    }

    #[test]
    fn test_save_api_key_writes_env() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(".env");
        let key = "sk-test-1234567890".to_string();
        std::fs::write(&path, format!("LLM_API_KEY={key}\n")).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("LLM_API_KEY=sk-test-1234567890"));
    }

    #[test]
    fn test_save_wechat_login_to_env_writes_runtime_keys() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(".env");
        std::fs::write(
            &path,
            "OTHER=value\nWEIXIN_DM_POLICY=pairing\nWEIXIN_ALLOW_ALL_USERS=false\n",
        )
        .unwrap();

        save_wechat_login_to_env(
            &path,
            "ef67f47fde1d@im.bot",
            "ef67f47fde1d@im.bot:token",
            "https://ilinkai.wechat.com",
            "o9cq80y9hyw4DRq-PNpfrtlnnzLA@im.wechat",
        )
        .unwrap();

        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("WEIXIN_ACCOUNT_ID=ef67f47fde1d@im.bot"));
        assert!(content.contains("WEIXIN_TOKEN=ef67f47fde1d@im.bot:token"));
        assert!(content.contains("WEIXIN_BASE_URL=https://ilinkai.wechat.com"));
        assert!(content.contains("WEIXIN_HOME_CHANNEL=o9cq80y9hyw4DRq-PNpfrtlnnzLA@im.wechat"));
        assert!(content.contains("WEIXIN_CDN_BASE_URL=https://novac2c.cdn.weixin.qq.com/c2c"));
        assert!(content.contains("WEIXIN_DM_POLICY=pairing"));
        assert!(content.contains("WEIXIN_ALLOW_ALL_USERS=false"));
        assert!(content.contains("WEIXIN_GROUP_POLICY=open"));
        assert!(content.contains("WEIXIN_ALLOWED_USERS="));
        assert!(content.contains("WEIXIN_GROUP_ALLOWED_USERS="));
        assert!(content.contains("OTHER=value"));
    }

    #[test]
    fn test_save_wechat_login_inherits_global_allow_all_defaults() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(".env");
        std::fs::write(&path, "GATEWAY_ALLOW_ALL_USERS=true\n").unwrap();

        save_wechat_login_to_env(
            &path,
            "ef67f47fde1d@im.bot",
            "ef67f47fde1d@im.bot:token",
            "https://ilinkai.wechat.com",
            "o9cq80y9hyw4DRq-PNpfrtlnnzLA@im.wechat",
        )
        .unwrap();

        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("GATEWAY_ALLOW_ALL_USERS=true"));
        assert!(content.contains("WEIXIN_ALLOW_ALL_USERS=true"));
        assert!(content.contains("WEIXIN_DM_POLICY=open"));
    }

    #[test]
    fn test_save_only_writes_model_fields() {
        // save_to must only touch model.provider and model.default
        // — other Hermes fields (terminal, memory, compression …) must be preserved
        let yaml = "memory:\n  memory_enabled: true\ncompression:\n  enabled: true\n";
        let dir = tempdir().unwrap();
        let path = dir.path().join("config.yaml");
        std::fs::write(&path, yaml).unwrap();

        let cfg = HermesConfig {
            provider: "anthropic".to_string(),
            model: "claude-opus-4-5".to_string(),
            ..HermesConfig::default()
        };
        cfg.save_to(&path).unwrap();

        let content = std::fs::read_to_string(&path).unwrap();
        // Model fields must be written
        assert!(content.contains("provider: anthropic"), "provider missing");
        assert!(content.contains("claude-opus-4-5"), "model missing");
        // Existing fields must be preserved
        assert!(content.contains("memory_enabled: true"), "memory wiped");
        assert!(content.contains("compression"), "compression wiped");
        // Non-Hermes keys must NOT be injected
        assert!(!content.contains("memory_limit_mb"), "spurious field written");
        assert!(!content.contains("persistent_memory"), "spurious field written");
        assert!(!content.contains("language:"), "spurious field written");
    }

    #[tokio::test]
    async fn test_get_system_locale_returns_nonempty() {
        let result = get_system_locale().await;
        assert!(result.is_ok());
        let locale = result.unwrap();
        assert!(!locale.is_empty(), "locale must not be empty");
    }
}
