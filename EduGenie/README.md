# EduGenie

Folder layout:

    edugenie/
      index.html  style.css  script.js     <- the page (open with Live Server)
      backend/
        main.py   ai.py                    <- FastAPI server
        requirements.txt  .env.example

## 1. Start the backend (once per session)

    cd backend
    python -m venv venv
    venv\Scripts\activate            (Mac/Linux: source venv/bin/activate)
    pip install -r requirements.txt
    uvicorn main:app --reload

Check http://127.0.0.1:8000 in the browser. It should show {"app":"EduGenie","mode":"demo",...}.

## 2. Open the page

In VS Code, right-click index.html and choose "Open with Live Server".

## 3. Real answers (optional)

Copy .env.example to .env, paste your Gemini API key after GEMINI_API_KEY=, and restart uvicorn.
The check page above will then show "mode":"gemini".
If Gemini says the model name is not found, change GEMINI_MODEL in .env to a current one.

## Changing the address

If the backend runs on another port or machine, edit API_BASE at the top of script.js.
