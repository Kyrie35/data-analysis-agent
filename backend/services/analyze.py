from typing import Any

from services.agent import generate_analysis, generate_analysis_plan
from services.analysis_plan import (
    apply_transforms,
    infer_transforms_from_preferences,
    validate_transforms,
)
from services.charts import generate_charts
from services.metrics import compute_metrics
from services.parser import build_overview, load_dataframe
from services.plan_executor import execute_plan
from services.session_store import create_session


def _merge_transforms(
    plan_transforms: list[dict[str, Any]] | None,
    preferences: list[dict[str, Any]] | None,
    df,
    use_preferences: bool,
) -> list[dict[str, Any]]:
    specs = list(plan_transforms or [])
    if use_preferences and preferences:
        existing_cols = {item["column"] for item in specs}
        for inferred in infer_transforms_from_preferences(preferences, df):
            if inferred["column"] not in existing_cols:
                specs.append(inferred)
                existing_cols.add(inferred["column"])
    return validate_transforms(specs, df)


def analyze_upload(
    filename: str,
    content: bytes,
    use_preferences: bool = False,
    preferences: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    raw_df = load_dataframe(filename, content)
    result = build_overview(filename, raw_df)
    column_types = result["overview"]["column_types"]

    pipeline: dict[str, Any] = {
        "mode": "rules_fallback",
        "plan_status": "skipped",
        "message": None,
        "scenario": None,
        "focus": [],
        "applied_transforms": [],
        "preferences_applied": bool(use_preferences and preferences),
    }
    analysis_plan: dict[str, Any] | None = None
    working_df = raw_df
    applied: list[dict[str, Any]] = []

    # 1) AI 先读取偏好约束，产出 transforms + 可视化计划
    plan_result = generate_analysis_plan(
        raw_df,
        result["overview"],
        use_preferences=use_preferences,
        preferences=preferences,
    )
    pipeline["plan_status"] = plan_result.get("status") or "error"

    if plan_result.get("status") == "success" and plan_result.get("plan"):
        plan = plan_result["plan"]
        transform_specs = _merge_transforms(
            plan.get("transforms"),
            preferences,
            raw_df,
            use_preferences,
        )
        plan["transforms"] = transform_specs

        # 2) 偏好约束先作用于数据
        working_df, applied = apply_transforms(raw_df, transform_specs)
        pipeline["applied_transforms"] = applied

        adjusted_overview = build_overview(filename, working_df)
        result["preview"] = adjusted_overview["preview"]

        # 3) 在偏好口径上算指标/图
        executed = execute_plan(working_df, plan)
        metrics = executed.get("metrics") or []
        charts = executed.get("charts") or []

        if metrics or charts:
            analysis_plan = {**plan, "applied_transforms": applied}
            result["metrics"] = metrics
            result["charts"] = charts
            pipeline["mode"] = "ai_plan"
            pipeline["scenario"] = plan.get("scenario")
            pipeline["focus"] = plan.get("focus") or []
            if applied:
                labels = "、".join(item["label"] for item in applied)
                pipeline["message"] = f"已应用偏好约束后生成分析口径：{labels}"
            else:
                pipeline["message"] = "已按 AI 分析计划生成指标与图表"
        else:
            working_df, applied = apply_transforms(
                raw_df,
                _merge_transforms(None, preferences, raw_df, use_preferences),
            )
            pipeline["applied_transforms"] = applied
            result["metrics"] = compute_metrics(working_df, column_types)
            result["charts"] = generate_charts(working_df, column_types)
            result["preview"] = build_overview(filename, working_df)["preview"]
            pipeline["mode"] = "rules_fallback"
            pipeline["plan_status"] = "error"
            pipeline["message"] = "分析计划执行后无有效可视化，已回退规则引擎（仍尝试应用偏好变换）"
    else:
        # 规划失败也尽量应用可解析的偏好变换，再走规则可视化
        working_df, applied = apply_transforms(
            raw_df,
            _merge_transforms(None, preferences, raw_df, use_preferences),
        )
        pipeline["applied_transforms"] = applied
        result["metrics"] = compute_metrics(working_df, column_types)
        result["charts"] = generate_charts(working_df, column_types)
        result["preview"] = build_overview(filename, working_df)["preview"]
        pipeline["mode"] = "rules_fallback"
        if plan_result.get("status") == "skipped":
            base = plan_result.get("message") or "未配置 AI，已使用规则可视化"
        else:
            base = plan_result.get("message") or "AI 规划失败，已回退规则引擎"
        if applied:
            labels = "、".join(item["label"] for item in applied)
            pipeline["message"] = f"{base}；已应用偏好约束：{labels}"
        else:
            pipeline["message"] = base

    if not result.get("metrics"):
        result["metrics"] = compute_metrics(working_df, column_types)

    # 会话保存分析口径数据，追问与报告/图一致
    result["analysis_id"] = create_session(working_df, result["overview"])
    result["pipeline"] = pipeline

    # 4) 基于偏好口径指标/图写报告（报告使用的数字与可视化同源）
    result["analysis"] = generate_analysis(
        result["overview"],
        result["metrics"],
        result["charts"],
        result["preview"],
        use_preferences=use_preferences,
        preferences=preferences,
        analysis_plan=analysis_plan
        or ({"applied_transforms": applied} if applied else None),
    )

    return result
