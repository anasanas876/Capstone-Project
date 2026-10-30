import json
import logging
import os
import socket
import requests

logger = logging.getLogger(__name__)

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "llama-3.1-8b-instant"


# def is_ollama_running(host="127.0.0.1", port=11434, timeout=0.5) -> bool:
#     """Instant TCP socket check to verify if local Ollama daemon is active."""
#     try:
#         with socket.create_connection((host, port), timeout=timeout):
#             return True
#     except (socket.timeout, ConnectionRefusedError, OSError):
#         return False


def call_groq_ai(prompt: str) -> dict:
    """Dispatches prompt to Groq Cloud OpenAI-compatible endpoint."""
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "You are an ATS Recruitment Assistant. Respond strictly in valid JSON."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"}
    }
    
    response = requests.post(url, headers=headers, json=payload, timeout=15)
    response.raise_for_status()
    raw_content = response.json()["choices"][0]["message"]["content"]
    return json.loads(raw_content)


# def call_ollama_ai(prompt: str) -> dict:
#     """Dispatches prompt to local Ollama server."""
#     url = f"{OLLAMA_HOST}/api/generate"
#     payload = {
#         "model": OLLAMA_MODEL,
#         "prompt": prompt,
#         "stream": False,
#         "format": "json",
#         "options": {"temperature": 0.2, "num_predict": 300}
#     }
#     response = requests.post(url, json=payload, timeout=60)
#     response.raise_for_status()
#     raw_response = response.json().get("response", "{}")
#     return json.loads(raw_response)


def get_candidate_ai_insights(candidate, job) -> dict:
    
    missing_skills_str = ", ".join(candidate.missing_skills or []) or "None"
    matched_skills_str = ", ".join(candidate.matched_skills or []) or "None"
    must_have_missing_str = ", ".join(candidate.missing_must_have or []) or "None"

    # Dynamic prompt generated inside the function using candidate & job instances
    user_prompt = f"""
Job Title: {job.title}
Requirements Summary: {job.description[:500]}

Candidate: {candidate.name}
Overall Score: {candidate.total_score}%
Experience: {candidate.years_of_experience} yrs (Job requires {job.required_experience_years}+ yrs)
Matched Skills: {matched_skills_str}
Missing Skills: {missing_skills_str}
Resume Excerpt: {candidate.raw_text[:700] if candidate.raw_text else 'N/A'}

Respond strictly with valid JSON adhering to this exact structure:
{{
  "summary": "2 concise sentences assessing candidate fit.",
  "strengths": ["Key strength 1", "Key strength 2"],
  "red_flags": ["Potential gap 1", "Potential gap 2"],
  "interview_questions": [
    {{"question": "First targeted technical question.", "purpose": "Why to ask."}},
    {{"question": "Second targeted question.", "purpose": "Why to ask."}},
    {{"question": "Third targeted question.", "purpose": "Why to ask."}}
  ]
}}
"""

    # 1. Primary: Cloud LLM via Groq (Fastest & works on deployed cloud)
    if GROQ_API_KEY:
        try:
            insights = call_groq_ai(user_prompt)
            return {
                "success": True,
                "model_used": f"Groq Cloud ({GROQ_MODEL})",
                "insights": insights
            }
        except Exception as exc:
            logger.warning("Groq request failed, falling back: %s", exc)

    # For Testing locally
    # if is_ollama_running():
    #     try:
    #         insights = call_ollama_ai(user_prompt)
    #         return {
    #             "success": True,
    #             "model_used": f"Ollama Local ({OLLAMA_MODEL})",
    #             "insights": insights
    #         }
    #     except Exception as exc:
    #         logger.warning("Local Ollama request failed, falling back: %s", exc)

    # 3. Resilient Fallback: Deterministic generation (prevents app crashes)
    return {
        "success": False,
        "error_type": "OFFLINE_FALLBACK",
        "message": "AI server unreachable. Serving deterministic evaluation insights.",
        "fallback_preview": {
            "summary": (
                f"{candidate.name} achieved an overall match score of {candidate.total_score}% for {job.title}. "
                f"Candidate has {candidate.years_of_experience} years of detected experience "
                f"compared to the job requirement of {job.required_experience_years}+ years."
            ),
            "strengths": [
                f"Matched core target skills: {matched_skills_str}",
                f"Extracted work history contains {len(candidate.entries or [])} verifiable career role(s)."
            ],
            "red_flags": [
                f"Missing required must-have skills: {must_have_missing_str}" if candidate.missing_must_have
                else "No non-negotiable must-have skill gaps detected."
            ],
            "interview_questions": [
                {
                    "question": f"Can you walk us through a recent project where you applied your key skills in {job.title}?",
                    "purpose": "Verify hands-on technical competence and problem-solving process."
                },
                {
                    "question": f"How have you worked with or adapted to missing competencies such as {missing_skills_str}?",
                    "purpose": "Probe candidate's ability to learn and adapt to stack requirements."
                },
                {
                    "question": "Can you describe a challenging technical roadblock you resolved in your previous role?",
                    "purpose": "Assess resilience, debugging skills, and depth of experience."
                }
            ]
        }
    }