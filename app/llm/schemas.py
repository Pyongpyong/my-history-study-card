from __future__ import annotations

MCQ_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "mcq_card",
        "schema": {
            "type": "object",
            "properties": {
                "cards": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {"const": "MCQ"},
                            "question": {"type": "string", "maxLength": 80},
                            "options": {
                                "type": "array",
                                "items": {"type": "string", "maxLength": 12},
                                "minItems": 4,
                                "maxItems": 4,
                            },
                            "answer_index": {
                                "type": "integer",
                                "minimum": 0,
                                "maximum": 3,
                            },
                            "explain": {"type": "string", "maxLength": 80},
                        },
                        "required": ["type", "question", "options", "answer_index"],
                        "additionalProperties": False,
                    },
                    "minItems": 1,
                    "maxItems": 1,
                }
            },
            "required": ["cards"],
            "additionalProperties": False,
        },
    },
}

SHORT_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "short_card",
        "schema": {
            "type": "object",
            "properties": {
                "cards": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {"const": "SHORT"},
                            "prompt": {"type": "string", "maxLength": 80},
                            "answer": {"type": "string", "maxLength": 24},
                            "rubric": {
                                "type": "object",
                                "properties": {
                                    "aliases": {
                                        "type": "array",
                                        "items": {"type": "string", "maxLength": 12},
                                        "minItems": 0,
                                        "maxItems": 2,
                                    }
                                },
                                "required": ["aliases"],
                                "additionalProperties": False,
                            },
                        },
                        "required": ["type", "prompt", "answer", "rubric"],
                        "additionalProperties": False,
                    },
                    "minItems": 1,
                    "maxItems": 1,
                }
            },
            "required": ["cards"],
            "additionalProperties": False,
        },
    },
}

OX_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "ox_card",
        "schema": {
            "type": "object",
            "properties": {
                "cards": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {"const": "OX"},
                            "statement": {"type": "string", "maxLength": 80},
                            "answer": {"type": "boolean"},
                            "explain": {"type": "string", "maxLength": 80},
                        },
                        "required": ["type", "statement", "answer"],
                        "additionalProperties": False,
                    },
                    "minItems": 1,
                    "maxItems": 1,
                }
            },
            "required": ["cards"],
            "additionalProperties": False,
        },
    },
}

CLOZE_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "cloze_card",
        "schema": {
            "type": "object",
            "properties": {
                "cards": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {"const": "CLOZE"},
                            "text": {"type": "string", "maxLength": 120},
                            "clozes": {
                                "type": "object",
                                "properties": {
                                    "c1": {"type": "string", "maxLength": 10},
                                    "c2": {"type": "string", "maxLength": 20},
                                },
                                "required": ["c1"],
                                "additionalProperties": False,
                            },
                            "explain": {"type": "string", "maxLength": 80},
                        },
                        "required": ["type", "text", "clozes"],
                        "additionalProperties": False,
                    },
                    "minItems": 1,
                    "maxItems": 1,
                }
            },
            "required": ["cards"],
            "additionalProperties": False,
        },
    },
}

ORDER_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "order_card",
        "schema": {
            "type": "object",
            "properties": {
                "cards": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {"const": "ORDER"},
                            "items": {
                                "type": "array",
                                "items": {"type": "string", "maxLength": 18},
                                "minItems": 3,
                                "maxItems": 4,
                            },
                            "answer_order": {
                                "type": "array",
                                "items": {"type": "integer"},
                                "minItems": 3,
                                "maxItems": 4,
                            },
                            "explain": {"type": "string", "maxLength": 80},
                        },
                        "required": ["type", "items", "answer_order"],
                        "additionalProperties": False,
                    },
                    "minItems": 1,
                    "maxItems": 1,
                }
            },
            "required": ["cards"],
            "additionalProperties": False,
        },
    },
}

MATCH_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "match_card",
        "schema": {
            "type": "object",
            "properties": {
                "cards": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {"const": "MATCH"},
                            "left": {
                                "type": "array",
                                "items": {"type": "string", "maxLength": 12},
                                "minItems": 3,
                                "maxItems": 4,
                            },
                            "right": {
                                "type": "array",
                                "items": {"type": "string", "maxLength": 12},
                                "minItems": 3,
                                "maxItems": 4,
                            },
                            "pairs": {
                                "type": "array",
                                "items": {
                                    "type": "array",
                                    "items": {"type": "integer"},
                                    "minItems": 2,
                                    "maxItems": 2,
                                },
                                "minItems": 3,
                                "maxItems": 4,
                            },
                            "explain": {"type": "string", "maxLength": 80},
                        },
                        "required": ["type", "left", "right", "pairs"],
                        "additionalProperties": False,
                    },
                    "minItems": 1,
                    "maxItems": 1,
                }
            },
            "required": ["cards"],
            "additionalProperties": False,
        },
    },
}

RESPONSE_SCHEMAS_BY_TYPE = {
    "MCQ": MCQ_SCHEMA,
    "SHORT": SHORT_SCHEMA,
    "OX": OX_SCHEMA,
    "CLOZE": CLOZE_SCHEMA,
    "ORDER": ORDER_SCHEMA,
    "MATCH": MATCH_SCHEMA,
}


def get_schema(card_type: str) -> dict:
    return RESPONSE_SCHEMAS_BY_TYPE.get(str(card_type).upper(), SHORT_SCHEMA)
