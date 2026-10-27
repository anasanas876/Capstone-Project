import json
import logging
import os
import socket
import urllib.request
import urllib.error

logger = logging.getLogger(__name__)

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")


def is_ollama_running(host="127.0.0.1", port=11434, timeout=0.5):
    """Instant TCP socket check to verify if local Ollama daemon is active."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


def get_candidate_ai_insights(candidate, job):
    """
    Calls local Ollama instance (e.g. llama3.2:3b) to generate:
    1. Executive match summary (2-3 sentences)
    2. Candidate key strengths
    3. Potential red flags / skill gaps
    4. 3 Tailored interview questions probing their specific resume gaps.
    """
    missing_skills_str = ", ".join(candidate.missing_skills or []) or "None"
    matched_skills_str = ", ".join(candidate.matched_skills or []) or "None"
    must_have_missing_str = ", ".join(candidate.missing_must_have or []) or "None"

    # 1. Instant check if Ollama is running locally
    if not is_ollama_running():
        return {
            "success": False,
            "error_type": "OLLAMA_OFFLINE",
            "message": (
                "Local Ollama server is not running on 127.0.0.1:11434. "
                "Run 'ollama run llama3.2:3b' in your terminal to enable live local AI inference."
            ),
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

    system_prompt = (
        "You are an expert technical recruiter and talent assessment AI. "
        "Analyze the candidate's resume against the Job Description and return your evaluation "
        "strictly in valid JSON format with keys: 'summary', 'strengths', 'red_flags', 'interview_questions'."
    )

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
  "strengths": [
    "Key strength 1",
    "Key strength 2"
  ],
  "red_flags": [
    "Potential gap 1",
    "Potential gap 2"
  ],
  "interview_questions": [
    {{
      "question": "First targeted technical question.",
      "purpose": "Why to ask."
    }},
    {{
      "question": "Second targeted question.",
      "purpose": "Why to ask."
    }},
    {{
      "question": "Third targeted question.",
      "purpose": "Why to ask."
    }}
  ]
}}
"""

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": f"{system_prompt}\n\n{user_prompt}",
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.2,
            "num_predict": 250
        }
    }

    req = urllib.request.Request(
        f"{OLLAMA_HOST}/api/generate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req, timeout=150) as response:
            result = json.loads(response.read().decode("utf-8"))
            raw_response = result.get("response", "{}")
            parsed_insights = json.loads(raw_response)
            return {
                "success": True,
                "model_used": OLLAMA_MODEL,
                "insights": parsed_insights
            }

    except Exception as exc:
        logger.exception("AI generation failed: %s", exc)
        return {
            "success": False,
            "error_type": "INFERENCE_ERROR",
            "message": f"Inference error while parsing response: {str(exc)}"
        }
