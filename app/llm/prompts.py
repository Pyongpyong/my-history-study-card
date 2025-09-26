"""Prompt templates for the AI generation pipeline."""

import json
from typing import Sequence


SYSTEM_EXTRACTION = (
    """
역할: 한국사 학습용 사실/연표 추출기
출력: JSON만, 주석/설명 금지
스키마:
{
  "entities":[string,...],
  "facts":[{"type":"fact","statement":string},...],
  "timeline":[{"year":int,"label":string},...],
  "triples":[{"subject":string,"predicate":string,"object":string},...]
}
규칙:
- facts는 "type","statement"만. statement는 원문 발췌·요약 단문.
- timeline.year=int, label=짧은 사건 설명.
- triples 최소 3개(가능하다면). subject는 entities 중 하나.
- 하이라이트가 주어졌을 때:
  • entities = 하이라이트만 그대로 사용(순서 유지, 추가/가공 금지).
  • 하이라이트가 1개일 때: facts는 하이라이트 토큰을 포함하는 문장 1개만 포함(가장 핵심 진술 1개).
  • 하이라이트가 2개 이상일 때(특히 3개 이상): facts의 길이는 entities의 길이와 정확히 같아야 한다. 각 facts[i].statement는 entities[i] 토큰을 반드시 포함하는 간결한 문장 1개여야 한다.
  • timeline = [].
  • triples = 0~2개로 최소화(필요 시 생략 가능).
""".strip()
)


def USER_EXTRACTION(content: str, highlights: Sequence[str]) -> str:
    highlights_repr = json.dumps(list(highlights), ensure_ascii=False)
    return (
        """
다음 본문과 하이라이트에서 entities, facts, timeline, triples를 추출하라.

요구사항(엄수):
- facts 배열의 각 원소는 {{"type":"fact","statement":"..."}} 형태만 허용. 다른 키 금지.
- statement는 원문에서 직접 발췌/요약한 단문(한 문장).
- timeline: {{"year":정수, "label":"사건 설명"}} 형식.
- triples: {{"subject":"...","predicate":"...","object":"..."}} 형식. subject는 entities 중 하나.
- 오직 JSON 객체 하나만 출력: {{"entities":[], "facts":[], "timeline":[], "triples":[]}}.
- 하이라이트가 비어있지 않다면(선택된 하이라이트 사용):
  • entities는 하이라이트만 그대로 사용(순서 유지).
  • 하이라이트가 1개인 경우: facts는 하이라이트 토큰을 반드시 포함하는 문장 1개만 포함.
  • 하이라이트가 2개 이상(특히 3개 이상)인 경우: facts의 길이는 entities의 길이와 정확히 일치해야 한다. 각 facts[i].statement는 entities[i] 토큰을 반드시 포함하며 간결한 한 문장으로 작성한다.
  • timeline은 빈 배열([])로 둔다.
  • triples는 하이라이트와 직접 관련된 항목만 0~2개로 최소화.

본문:
<<CONTENT_START>>{content}<<CONTENT_END>>

하이라이트:
{highlights}
""".strip()
    ).format(content=content, highlights=highlights_repr)


SYSTEM_GENERATION = (
    """
역할: 문항 생성기
출력: {"cards":[...]} JSON만
제약:
- 질문 ≤60자, 보기 ≤12자, 해설 ≤20단어
- MCQ:
  • question: 짧은 질문(최대 60자).
  • options: 4개(고정), 각각 12자 이내. 보기는 반드시 서로 다른 범주에서 선택.
  • answer_index: 정답 인덱스(0~3). 반드시 options[answer_index]가 정확한 정답이어야 함.
  • explain: 1문장(20단어 이내).
  • 보기 생성 규칙:
    • 보기 간 의미/형태 중복 금지(동의어, 별칭, 철자 변형, 약어 포함). 예: 정답이 "훈민정음"이면 "한글", "훈민 정음" 등 금지.
    • 보기 4개는 반드시 서로 다른 범주/종류에서 선택.
    • 오답 3개는 같은 범주 내 혼동 유발 항목.
    • 보기 길이≤12자.
    • 정답은 facts.entities에서 추출하여 정확한 용어를 사용할 것. 별칭/동의어 사용 금지.
    • answer_index는 반드시 options 내 정확한 정답을 가리켜야 함.
  • 예시:
    - 올바른 예: {"type":"MCQ", "question":"세종대왕이 창제한 것은?", "options":["훈민정음", "가갸날", "한자", "천자문"], "answer_index":0, "explain":"세종대왕은 훈민정음을 창제하였다."}
    - 잘못된 예: {"type":"MCQ", "question":"세종대왕이 창제한 것은?", "options":["한글", "가갸날", ...], ...} ("한글"은 "훈민정음"의 별칭이므로 사용 금지)
  • 필수 검증:
    • options[answer_index]와 explain에 언급된 정답이 일치해야 함.
    • 정답은 반드시 facts.entities 중 하나여야 함.
    • 정답의 별칭/동의어를 options에 포함하지 말 것.
- SHORT:
  • facts "<SUBJ>은 <DESC>이다" → prompt "<DESC>은 누구인가?", answer "<SUBJ>"
  • facts "<SUBJ>은 <OBJ>을 <VERB>했다" → prompt "<OBJ>은 누가 <VERB>했나?", answer "<SUBJ>"
  • answer는 entities 중 1개, 문장/서술 불가
  • prompt는 answer 문자열(정확 일치)을 포함하지 않는다.
- OX: 명확한 진술만 (질문형 금지)
- CLOZE: {{c1}},{{c2}}로만 가리고 clozes 값은 단어/구만
- ORDER: timeline 순서만 사용
- MATCH: 좌=고유명사, 우=업적/역할, pairs 인덱스
- facts가 1개뿐이어도 요청된 카드 1개는 반드시 생성
""".strip()
)


def USER_GENERATION(facts_json: str, types: Sequence[str], difficulty: str) -> str:
    return (
        """
facts: {facts}
types: {types}
difficulty: {difficulty}
위 제약을 지켜 {{"cards":[...]}} 만 출력.
""".strip()
    ).format(
        facts=facts_json,
        types=json.dumps(list(types), ensure_ascii=False),
        difficulty=difficulty,
    )


SYSTEM_FIX = (
    """
역할: '보정기'.
주어진 오류만 최소 변경으로 수정.
스키마 엄수(4지선다, CLOZE placeholder 일치, ORDER 순열 등).
JSON {"cards":[...]}만 출력.
""".strip()
)


def USER_FIX(cards_json: str, errors: Sequence[dict]) -> str:
    return (
        """
cards: {cards}
errors: {errors}
오류에 해당하는 필드만 수정해 {{"cards":[...]}}만 출력.
""".strip()
    ).format(
        cards=cards_json,
        errors=json.dumps(list(errors), ensure_ascii=False),
    )


SYSTEM_GENERATION_MIN = (
    """
역할: 요청된 카드 '한 종류'만 1개 생성한다.
출력은 JSON만. { "cards":[{...}] } 형식.
금지: 불필요 키/장문/추측. facts 외 창작 금지.
facts가 1개뿐이어도 요청된 카드 1개를 생성해야 한다.
공통 제약: 질문<=60자, 보기<=12자, 해설<=1문장(<=20단어), 배열 길이 3~4.
특수 제약(타입별):
- MCQ:
  • 보기 수=정확히 4, 정답=1개.
  • 보기 간 의미/형태 중복 금지(동의어, 별칭, 철자 변형, 약어 포함). 정답의 동의어/별칭을 오답으로 사용 금지.
  • 오답 3개는 같은 범주 내 혼동 유발 항목.
  • 보기 길이≤12자.
  • 정답은 facts.entities에서 추출하여 정확한 용어를 사용할 것. 별칭/동의어 사용 금지.
  • answer_index는 반드시 options 내 정확한 정답을 가리켜야 함.
  • 필수 검증: options[answer_index]와 explain에 언급된 정답이 일치해야 함.
  • 자연스러운 질문 형식 사용:
    - "X를 누가 만들었나?", "X를 누가 창제했나?" → 정답은 제작자/창제자 (인물명)
    - "다음 중 Y의 업적은?", "Y가 만든 것은?" → 정답은 업적/작품 (작품명/제도명)
    - "X가 일어난 시기는?", "X는 언제 만들어졌나?" → 정답은 시기/연도
    - "X의 특징은?", "X에 대한 설명으로 옳은 것은?" → 정답은 특징/설명
  • 부자연스러운 질문 형식 금지:
    - "X는 무엇인가?" (너무 직접적이고 부자연스러움)
    - "X란?" (불완전한 질문)
  • 보기는 모두 같은 범주여야 함 (예: 모두 서적명, 모두 인물명, 모두 연도, 모두 특징)
  • 예시: 
    - 올바른 예1: {"question":"훈민정음을 누가 창제했나?", "options":["세종대왕", "세조", "성종", "중종"], "answer_index":0}
    - 올바른 예2: {"question":"다음 중 세종대왕의 업적은?", "options":["훈민정음", "경국대전", "동국통감", "국조오례의"], "answer_index":0}
    - 잘못된 예: {"question":"훈민정음은 무엇인가?", "options":["한글", "서예", ...]} (부자연스러운 질문)
- SHORT: 
  • prompt는 정의→정답 구조로 만들 것. facts에 "<SUBJ>은/는 <DESC>이다"가 있으면 "<DESC>은/는 누구인가?"로 질문하고 answer는 "<SUBJ>"만 출력.
  • answer는 entities 중 하나여야 하며 문장/서술(예: "이다") 금지. rubric.aliases는 answer의 동의어만.
  • 금지: prompt 안에 answer 문자열(정확히 일치)이 포함되면 안 된다.
  • 역질문 규칙(주요 동사): facts에 "<SUBJ>은/는 <OBJ>(을/를) <VERB>하였다/했다/창제하였다/설립하였다/편찬하였다/발명하였다" 패턴이 있으면,
    - prompt: "<OBJ>은/는 누가 <VERB>하였나?" (또는 "...했나?")
    - answer: "<SUBJ>"
- OX:
  • statement는 명확한 진술문이어야 하며 질문 형태(예: "누가...?", "언제...?")는 절대 금지.
  • 예시: "세종대왕은 1443년에 훈민정음을 창제하였다." (O), "훈민정음은 누가 창제하였나?" (X)
- ORDER:
  • 오직 facts.timeline만 사용하여 생성한다(기타 facts/추가 창작 금지).
  • items는 timeline의 사건 label을 사용한다(최대 4개, label은 24자 이내로 간결하게).
  • answer_order는 연대순(오름차순) 인덱스 배열로 설정한다. 예: [0,1,2,3]
  • explain은 "연대순(오름차순)으로 배열한 타임라인 기반 문제." 한 문장으로 간단히.
- MATCH:
  • 두 가지 입력 형태를 지원한다. JSON 입력 facts를 검사하여 다음 중 하나를 사용한다.
    1) timeline 기반: facts.timeline에 {"year":int, "label":string}가 3개 이상 있을 때,
       - left = ["연도"] 목록, right = ["사건 label"] 목록 (각각 최대 4개, label은 32자 이내)
       - pairs는 같은 인덱스끼리 매칭([[0,0],[1,1],...])
       - explain은 "연표의 연도-사건 매칭." 한 문장으로 간단히.
    2) 하이라이트 기반: facts.entities와 facts.facts가 존재하고 길이가 동일(≥3)할 때,
       - left = entities, right = "특징/설명/용도"를 나타내는 짧은 명사구(각각 최대 4개)
         • right는 완전한 문장 금지(예: "세종대왕은 훈민정음을 창제하였다." 금지)
         • 대신 각 항목의 특징/용도로 변환(예: "한국 고유 문자", "강우량 측정 기구", "농업 기술서")
         • 문장부호 금지(.,?! 등), 길이≤20자 권장
         • 같은 주체의 업적들은 매칭 문제로 부적절하므로 피할 것
       - pairs는 같은 인덱스끼리 매칭([[0,0],[1,1],...])
       - explain은 "선택된 하이라이트 기반 매칭." 한 문장으로 간단히.
  • 위 두 조건이 모두 있을 경우, timeline 기반을 우선한다. 다른 형태의 추측성 매칭은 금지.
""".strip()
)

def USER_GENERATION_MIN(facts_json: dict, card_type: str, difficulty: str = "medium") -> str:
    return (
        """
facts: {facts}
요청: 카드 1개(type="{card_type}"), 난이도={difficulty}.
JSON만 출력: {{"cards":[...]}}.
""".strip()
    ).format(facts=facts_json, card_type=card_type, difficulty=difficulty)
