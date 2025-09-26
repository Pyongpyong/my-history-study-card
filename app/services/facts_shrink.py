from __future__ import annotations


def _pick(xs, n):
    return [x for x in xs[:n]] if isinstance(xs, list) else []


def shrink_for_type(facts: dict, card_type: str) -> dict:
    if not isinstance(facts, dict):
        return {}
    entities = facts.get("entities", [])
    stmts = [
        f.get("statement")
        for f in facts.get("facts", [])
        if isinstance(f, dict) and f.get("statement")
    ]
    eN, sN = 3, 2
    if card_type in ("OX", "SHORT"):
        eN, sN = 2, 2
    if card_type == "MCQ":
        eN, sN = 3, 2
    if card_type == "CLOZE":
        eN, sN = 2, 1
    if card_type == "ORDER":
        eN, sN = 3, 3
    if card_type == "MATCH":
        eN, sN = 4, 3
    out = {
        "entities": _pick(entities, eN),
        "facts": [{"statement": s} for s in _pick(stmts, sN)],
    }
    return out
