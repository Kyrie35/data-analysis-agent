from typing import Any

MAX_PREFERENCES_PER_REQUEST = 5
MAX_CONTENT_LENGTH = 300
MAX_TITLE_LENGTH = 80


def normalize_preferences(
    use_preferences: bool,
    preferences: list[dict[str, Any]] | None,
) -> list[dict[str, str]]:
    if not use_preferences or not preferences:
        return []

    normalized: list[dict[str, str]] = []
    for item in preferences[:MAX_PREFERENCES_PER_REQUEST]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()[:MAX_TITLE_LENGTH]
        content = str(item.get("content", "")).strip()[:MAX_CONTENT_LENGTH]
        if not title and not content:
            continue
        if not title:
            title = "未命名偏好"
        if not content:
            continue
        normalized.append({"title": title, "content": content})

    return normalized


def format_preferences_block(preferences: list[dict[str, str]]) -> str:
    if not preferences:
        return ""

    lines = [
        "## 用户分析偏好（必须尊重其视角与侧重点，但不得编造数据）",
        "以下偏好只影响分析角度与表达重点；若偏好与数据摘要冲突，以数据为准；",
        "摘要中没有依据时，请明确说明无法从现有数据得出结论。",
        "",
    ]
    for item in preferences:
        lines.append(f"### {item['title']}")
        lines.append(item["content"])
        lines.append("")

    return "\n".join(lines).strip()
