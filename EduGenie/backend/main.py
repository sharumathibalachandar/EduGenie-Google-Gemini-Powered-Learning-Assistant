from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import ai

app = FastAPI(title="EduGenie")

# Lets the page opened with Live Server (port 5500) talk to this server (port 8000).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class TopicIn(BaseModel):
    topic: str


class TextIn(BaseModel):
    text: str


def run(fn, *args):
    try:
        return fn(*args)
    except ai.AIError as err:
        raise HTTPException(status_code=502, detail=str(err))


@app.get("/")
def status():
    return {"app": "EduGenie", "mode": "demo" if ai.DEMO else "gemini", "model": ai.MODEL}


@app.get("/qa")
def qa(question: str):
    return {"answer": run(ai.answer, question)}


@app.post("/explain")
def explain(body: TopicIn):
    return {"explanation": run(ai.explain, body.topic)}


@app.post("/summarize")
def summarize(body: TextIn):
    return {"summary": run(ai.summarize, body.text)}


@app.post("/quiz")
def quiz(body: TextIn):
    return {"quiz": run(ai.make_quiz, body.text)}


@app.get("/learn/recommendations")
def recommendations(topic: str):
    return {"recommendation": run(ai.learning_path, topic)}
