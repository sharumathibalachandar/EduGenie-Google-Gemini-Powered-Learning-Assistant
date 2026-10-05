import json
import os
import re

from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()

# With no key the server still runs and returns clearly labelled sample replies,
# so you can test the whole page before setting up Gemini.
DEMO = not API_KEY

DEMO_NOTE = "**Demo mode.** Add your Gemini key in backend/.env to get real answers.\n\n"

_client = None


class AIError(Exception):
    pass


def _generate(prompt, json_mode=False):
    global _client
    from google import genai
    from google.genai import types

    if _client is None:
        _client = genai.Client(api_key=API_KEY)

    config = types.GenerateContentConfig(response_mime_type="application/json") if json_mode else None
    try:
        reply = _client.models.generate_content(model=MODEL, contents=prompt, config=config)
    except Exception as err:
        raise AIError(f"Gemini request failed: {err}")

    if not reply.text:
        raise AIError("Gemini returned an empty reply. Try rephrasing.")
    return reply.text.strip()


def answer(question):
    if DEMO:
        return DEMO_NOTE + f"You asked: {question}"
    return _generate(
        "Answer this student's question clearly and briefly, in simple language. "
        "Use short paragraphs or bullet points.\n\nQuestion: " + question
    )


def explain(topic):
    if DEMO:
        return DEMO_NOTE + f"## What is {topic}?\n- A short explanation would appear here.\n- Then an example.\n- Then a quick recap."
    return _generate(
        f"Explain '{topic}' to a student who is new to it. Start with the main idea in two sentences, "
        "then give one everyday example, then a short recap. Use simple language and bullet points where useful."
    )


def summarize(text):
    if DEMO:
        return DEMO_NOTE + "- Your summary would appear here as short bullet points."
    return _generate(
        "Summarize the passage below as 4 to 6 short bullet points covering the main ideas only.\n\n"
        + text[:12000]
    )


def learning_path(topic):
    if DEMO:
        return DEMO_NOTE + f"## Learning path for {topic}\n1. Basics\n2. Practice\n3. A small project"
    return _generate(
        f"Give a step-by-step learning path for a beginner learning '{topic}'. "
        "Use a numbered list of 5 to 7 steps. For each step give a short title and one line on what to do."
    )


def _demo_quiz(text):
    topic = text.strip()[:40]
    return [
        {
            "question": f"Demo question 1 about {topic}: what is a good first step when learning something new?",
            "options": ["Learn the basics", "Skip to advanced topics", "Memorize everything", "Wait for motivation"],
            "answer": "Learn the basics",
        },
        {
            "question": "Demo question 2: which habit helps you remember things longer?",
            "options": ["Cramming once", "Reviewing a little each day", "Reading only once", "Avoiding practice"],
            "answer": "Reviewing a little each day",
        },
    ]


def make_quiz(text):
    if DEMO:
        return _demo_quiz(text)

    raw = _generate(
        "Create 5 multiple-choice questions to test understanding of the topic or passage below. "
        "Return a JSON array. Each item must have: \"question\" (string), \"options\" (array of exactly 4 strings), "
        "and \"answer\" (a string that is exactly equal to one of the options).\n\n" + text[:8000],
        json_mode=True,
    )

    cleaned = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.M).strip()
    try:
        data = json.loads(cleaned)
    except ValueError:
        raise AIError("Could not read the quiz from Gemini. Please try again.")

    if isinstance(data, dict):
        data = data.get("quiz", [])

    quiz = [
        q for q in data
        if isinstance(q, dict) and q.get("question") and isinstance(q.get("options"), list) and q.get("answer")
    ]
    if not quiz:
        raise AIError("Gemini did not return a usable quiz. Try a more specific topic.")
    return quiz
