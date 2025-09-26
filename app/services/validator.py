from __future__ import annotations

import re
from typing import Dict, List, Tuple


def validate_cards(payload: Dict[str, object]) -> Tuple[bool, List[Dict[str, object]]]:
    """Validate card payload produced by the LLM.

    Returns (is_valid, errors). Errors contain structured metadata so the
    downstream fixer can react accordingly.
    """

    cards = payload.get("cards") if isinstance(payload, dict) else None
    if not isinstance(cards, list):
        return False, [{"code": "invalid_cards", "message": "cards must be a list"}]

    errors: List[Dict[str, object]] = []
    for idx, card in enumerate(cards):
        if not isinstance(card, dict):
            errors.append({
                "code": "card_not_object",
                "card_index": idx,
                "message": "각 카드 항목은 객체(JSON)여야 합니다.",
            })
            continue
        card_type = card.get("type")
        if card_type not in {"MCQ", "SHORT", "OX", "CLOZE", "ORDER", "MATCH"}:
            errors.append({
                "code": "unknown_type",
                "card_index": idx,
                "message": f"지원되지 않는 카드 타입: {card_type}",
            })
            continue

        validator = _CARD_VALIDATORS.get(card_type)
        if validator is None:
            continue
        validator(card, idx, errors)

    return len(errors) == 0, errors


def _validate_mcq(card: Dict[str, object], idx: int, errors: List[Dict[str, object]]) -> None:
    options = card.get("options") if isinstance(card.get("options"), list) else None
    answer_index = card.get("answer_index")
    explain = str(card.get("explain", "")).strip()
    
    if not options or len(options) < 3:
        errors.append({
            "code": "mcq_options_length",
            "card_index": idx,
            "message": "MCQ는 보기 3개 이상이어야 합니다.",
        })
        return
    normalized = [str(option).strip() for option in options]
    if any(not option for option in normalized):
        errors.append({
            "code": "mcq_option_empty",
            "card_index": idx,
            "message": "MCQ 보기에는 빈 항목이 없어야 합니다.",
        })
    if len(set(normalized)) != len(normalized):
        errors.append({
            "code": "mcq_option_duplicate",
            "card_index": idx,
            "message": "MCQ 보기에는 중복이 없어야 합니다.",
        })
    
    # Check for auto-generated filler options
    for i, opt in enumerate(normalized):
        if "자동 생성" in opt or "오답" in opt:
            errors.append({
                "code": "mcq_option_filler",
                "card_index": idx,
                "message": "MCQ 보기에 자동 생성된 임시 오답이 포함되어 있습니다.",
                "meta": {"option_index": i},
            })
    
    # Semantic duplicate check (aliases/synonyms/space variants)
    def _canon(value: str) -> str:
        v = re.sub(r"\s+", "", value).lower()
        # explicit alias mapping
        alias = {
            "훈민정음": "훈민정음",
            "한글": "훈민정음",
            "hunminjeongeum": "훈민정음",
        }
        # ascii fold simple:
        if v in alias:
            return alias[v]
        # remove punctuation and common separators
        v2 = re.sub(r"[\-·_]", "", v)
        # collapse repeated chars/spaces already removed
        return v2
    seen: dict[str, int] = {}
    for i, opt in enumerate(normalized):
        key = _canon(opt)
        if key in seen and seen[key] != i:
            errors.append({
                "code": "mcq_option_semantic_duplicate",
                "card_index": idx,
                "message": "MCQ 보기에는 동의어/별칭/형태변환(공백/하이픈 등) 중복이 없어야 합니다.",
                "meta": {"duplicate_of": seen[key], "option_index": i},
            })
        else:
            seen[key] = i
    
    if not isinstance(answer_index, int) or not (0 <= answer_index < len(normalized)):
        errors.append({
            "code": "mcq_answer_index",
            "card_index": idx,
            "message": "answer_index가 보기 범위 안에 있어야 합니다.",
        })
    
    # Check if explain mentions a different answer than options[answer_index]
    if explain and isinstance(answer_index, int) and 0 <= answer_index < len(normalized):
        selected_option = normalized[answer_index]
        # Extract potential answers from explain text
        import re as regex
        # Look for patterns like "세종대왕은 훈민정음을 창제하였다"
        answer_matches = regex.findall(r'([가-힣A-Za-z0-9]{2,})[을를이가는은]\s*(?:창제|발명|편찬|건립|설립|수립|반포)', explain)
        if answer_matches:
            explain_answer = answer_matches[0]
            if _canon(explain_answer) != _canon(selected_option):
                errors.append({
                    "code": "mcq_answer_mismatch",
                    "card_index": idx,
                    "message": f"explain에 언급된 정답({explain_answer})과 options[answer_index]({selected_option})가 일치하지 않습니다.",
                    "meta": {"explain_answer": explain_answer, "selected_option": selected_option},
                })
    
    # Check for unnatural question formats
    question = str(card.get("question", "")).strip()
    if question:
        unnatural_patterns = ["무엇인가", "란?", "이란?"]
        if any(pattern in question for pattern in unnatural_patterns):
            errors.append({
                "code": "mcq_unnatural_question",
                "card_index": idx,
                "message": "MCQ 질문이 부자연스럽습니다. '누가 만들었나?', '다음 중 X의 업적은?' 등의 형식을 사용하세요.",
                "meta": {"question": question},
            })
    
    # Check for category consistency in options
    # if question and len(normalized) >= 4:
    #     person_indicators = ["왕", "대왕", "조", "종", "제", "공", "후"]
    #     book_indicators = ["서", "록", "집", "전", "지", "편", "책"]
        
    #     person_count = sum(1 for opt in normalized if any(ind in opt for ind in person_indicators))
    #     book_count = sum(1 for opt in normalized if any(ind in opt for ind in book_indicators))
        
    #     # If we have both person names and book types, it's likely a category mix
    #     if person_count > 0 and book_count > 0:
    #         errors.append({
    #             "code": "mcq_category_mix",
    #             "card_index": idx,
    #             "message": "MCQ 보기에 서로 다른 범주(인물명/서적명 등)가 혼재되어 있습니다.",
    #             "meta": {"person_count": person_count, "book_count": book_count},
    #         })


def _validate_short(card: Dict[str, object], idx: int, errors: List[Dict[str, object]]) -> None:
    answer = str(card.get("answer", "")).strip()
    if not answer:
        errors.append({
            "code": "short_answer_missing",
            "card_index": idx,
            "message": "SHORT 유형은 answer가 반드시 필요합니다.",
        })
    rubric = card.get("rubric")
    if isinstance(rubric, dict):
        aliases = rubric.get("aliases")
        if isinstance(aliases, list):
            normalized_aliases = [_normalize_alias(str(item)) for item in aliases if str(item).strip()]
            rubric["aliases"] = list({alias for alias in normalized_aliases if alias})
        else:
            rubric["aliases"] = []
    else:
        card["rubric"] = {"aliases": []}


def _normalize_alias(value: str) -> str:
    cleaned = re.sub(r"[\(\)\[\]\{\}]", "", value)
    cleaned = re.sub(r"\s+", "", cleaned)
    return cleaned


def _validate_ox(card: Dict[str, object], idx: int, errors: List[Dict[str, object]]) -> None:
    statement = str(card.get("statement", "")).strip()
    if not statement:
        errors.append({
            "code": "ox_statement",
            "card_index": idx,
            "message": "OX 진술은 비어 있을 수 없습니다.",
        })


def _validate_cloze(card: Dict[str, object], idx: int, errors: List[Dict[str, object]]) -> None:
    text = str(card.get("text", ""))
    clozes = card.get("clozes") if isinstance(card.get("clozes"), dict) else {}
    placeholders = re.findall(r"\{\{(c\d+)\}\}", text)
    unique_placeholders = list(dict.fromkeys(placeholders))
    if len(unique_placeholders) == 0:
        errors.append({
            "code": "cloze_placeholder_missing",
            "card_index": idx,
            "message": "CLOZE 문항에는 {{c1}} 형태의 공백이 최소 1개 있어야 합니다.",
        })
    if len(unique_placeholders) > 2:
        errors.append({
            "code": "cloze_placeholder_limit",
            "card_index": idx,
            "message": "CLOZE 문항은 최대 두 개의 공백만 허용됩니다.",
        })
    for placeholder in unique_placeholders:
        if placeholder not in clozes:
            errors.append({
                "code": "cloze_key_missing",
                "card_index": idx,
                "message": f"{placeholder} 에 해당하는 정답이 clozes에 없습니다.",
            })
    for key in list(clozes.keys()):
        if key not in unique_placeholders:
            errors.append({
                "code": "cloze_extra_key",
                "card_index": idx,
                "message": f"{key} 키는 텍스트에 존재하지 않습니다.",
            })


def _validate_order(card: Dict[str, object], idx: int, errors: List[Dict[str, object]]) -> None:
    items = card.get("items") if isinstance(card.get("items"), list) else None
    order = card.get("answer_order") if isinstance(card.get("answer_order"), list) else None
    if not items or not order:
        errors.append({
            "code": "order_missing",
            "card_index": idx,
            "message": "ORDER 문항은 items와 answer_order가 필요합니다.",
        })
        return
    if sorted(order) != list(range(len(items))):
        errors.append({
            "code": "order_not_permutation",
            "card_index": idx,
            "message": "answer_order는 0..n-1 순열이어야 합니다.",
        })


def _validate_match(card: Dict[str, object], idx: int, errors: List[Dict[str, object]]) -> None:
    left = card.get("left") if isinstance(card.get("left"), list) else None
    right = card.get("right") if isinstance(card.get("right"), list) else None
    pairs = card.get("pairs") if isinstance(card.get("pairs"), list) else None
    if not left or not right or not pairs:
        errors.append({
            "code": "match_missing",
            "card_index": idx,
            "message": "MATCH 문항은 left/right/pairs가 모두 필요합니다.",
        })
        return
    used_left = set()
    used_right = set()
    for pair in pairs:
        if not isinstance(pair, list) or len(pair) != 2:
            errors.append({
                "code": "match_pair_shape",
                "card_index": idx,
                "message": "pairs 항목은 [left_index, right_index] 형태여야 합니다.",
            })
            continue
        left_idx, right_idx = pair
        if not isinstance(left_idx, int) or not (0 <= left_idx < len(left)):
            errors.append({
                "code": "match_left_range",
                "card_index": idx,
                "message": "left 인덱스가 범위를 벗어났습니다.",
            })
        if not isinstance(right_idx, int) or not (0 <= right_idx < len(right)):
            errors.append({
                "code": "match_right_range",
                "card_index": idx,
                "message": "right 인덱스가 범위를 벗어났습니다.",
            })
        if left_idx in used_left or right_idx in used_right:
            errors.append({
                "code": "match_duplicate",
                "card_index": idx,
                "message": "하나의 항목은 한 번만 매칭되어야 합니다.",
            })
        used_left.add(left_idx)
        used_right.add(right_idx)


_CARD_VALIDATORS = {
    "MCQ": _validate_mcq,
    "SHORT": _validate_short,
    "OX": _validate_ox,
    "CLOZE": _validate_cloze,
    "ORDER": _validate_order,
    "MATCH": _validate_match,
}

