import math
import re
from datetime import datetime

from docx import Document
from pypdf import PdfReader

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    # Graceful fallback in case scikit-learn wheel is still installing
    TfidfVectorizer = None
    cosine_similarity = None


DEFAULT_WEIGHTS = {"skills": 40, "experience": 30, "keywords": 30}

DEFAULT_TARGET_SKILLS = [
    "python", "django", "javascript", "react", "sql",
    "machine learning", "deep learning", "data analysis",
    "artificial intelligence", "natural language processing",
    "project management", "communication", "problem solving",
    "rest api", "rest apis", "aws", "azure", "git",
]


class ResumeReadError(Exception):
    """Raised when a resume cannot be read (bad type, corrupt, no text)."""


EMAIL_PATTERN = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
LINKEDIN_PATTERN = r'(?:linkedin\.com/in/|linkedin:?\s*)([a-zA-Z0-9-]+)'
GITHUB_PATTERN = r'(?:github\.com/|github:?\s*)([a-zA-Z0-9-]+)'
URL_PATTERN = r'https?://[^\s<>"{}|\\^`\[\]]+'

ACTION_VERBS = (
    'achieved', 'administered', 'analyzed', 'architected', 'automated',
    'built', 'collaborated', 'configured', 'created', 'delivered',
    'designed', 'developed', 'drove', 'enhanced', 'established',
    'executed', 'implemented', 'improved', 'increased', 'integrated',
    'launched', 'led', 'managed', 'mentored', 'migrated',
    'optimized', 'orchestrated', 'oversaw', 'pioneered', 'planned',
    'reduced', 'refactored', 'resolved', 'scaled', 'secured',
    'spearheaded', 'streamlined', 'supervised', 'transformed', 'upgraded',
)

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "may": 5, "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

EXPERIENCE_HEADINGS = {
    "experience", "work experience", "professional experience",
    "work history", "employment history", "previous experience",
}
SKILLS_HEADINGS = {
    "skills", "key skills", "core skills", "technical skills",
    "professional skills", "soft skills",
}
OTHER_HEADINGS = {
    "education", "interests", "interest", "qualifications",
    "certificates", "certifications", "objectives", "summary",
    "projects", "references", "achievements", "languages",
}

# Compiled once at import time, not on every call
DATE_RANGE_PATTERN = re.compile(r"\b\d{2}-\d{4}\s*[-–—]\s*\d{2}-\d{4}\b")

JOB_PATTERN = re.compile(
    r"(?:\w+\s){0,2}"
    r"(?:Engineer|Developer|Manager|Analyst|Designer|Intern|Consultant|"
    r"Director|Lead|Officer|Specialist|Administrator|Architect)\b",
    re.IGNORECASE,
)
COMPANY_PATTERN = re.compile(r"^[A-Z][\w&.']*(?:\s+[A-Z][\w&.']*){0,3}$")
LOCATION_PATTERN = re.compile(
    r'(?:Location|Address|Based in|City)[:\s]+([A-Za-z\s,]+)|'
    r'([A-Za-z]+,\s*[A-Z]{2})\s*\d{5}|'            # City, ST ZIP
    r'([A-Za-z]+,\s*[A-Za-z\s]+,\s*[A-Za-z]+)'     # City, State, Country
)

# Headers recognised inside a job description
JD_EXP_HEADERS = ("experience", "required experience",
                  "minimum professional experience", "professional experience")
JD_SKILLS_HEADERS = ("skills", "target skills", "required skills",
                     "key skills", "core skills")
JD_OTHER_HEADERS = ("objectives", "about us", "company culture",
                    "working conditions", "nice to have")


def has_word(skill, text):
    """Whole word/phrase match, so 'java' does not match 'javascript'."""
    return re.search(rf"(?<!\w){re.escape(skill)}(?!\w)", text) is not None


def clean_heading(text):
    return re.sub(r"[:\s]+$", "", text.strip().lower())


def find_date(text):
    return DATE_RANGE_PATTERN.search(text)


def month_num(name):
    return MONTHS[name[:3].lower()]


def detect_bullet_lines(line):
    stripped = line.strip()
    return bool(
        stripped.startswith(('•', '-', '*', '●', '○'))
        or re.match(r"\d+[.)]\s", stripped)
    )


def normalize_dates(text):
    now = datetime.now().strftime("%m-%Y")

    month = (
        r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|"
        r"apr(?:il)?|may|jun(?:e)?|jul(?:y)?|"
        r"aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|"
        r"nov(?:ember)?|dec(?:ember)?)"
    )

    # Jan 2022 - Dec 2024
    text = re.sub(
        rf"\b{month}\s+(\d{{4}})\s*[-–—]\s*"
        rf"{month}\s+(\d{{4}})\b",
        lambda m: (
            f"{month_num(m.group(1)):02d}-{m.group(2)} – "
            f"{month_num(m.group(3)):02d}-{m.group(4)}"
        ),
        text,
        flags=re.IGNORECASE,
    )

    # Jan 2022 - Present
    text = re.sub(
        rf"\b{month}\s+(\d{{4}})\s*[-–—]?\s*"
        r"(present|current|now|ongoing)\b",
        lambda m: f"{month_num(m.group(1)):02d}-{m.group(2)} – {now}",
        text,
        flags=re.IGNORECASE,
    )

    # 2022 - Present
    text = re.sub(
        r"\b(\d{4})\s*[-–—]\s*(present|current|now|ongoing)\b",
        lambda m: f"01-{m.group(1)} – {now}",
        text,
        flags=re.IGNORECASE,
    )

    # 2022 - 2024
    text = re.sub(
        r"\b(\d{4})\s*[-–—]\s*(\d{4})\b",
        lambda m: f"01-{m.group(1)} – 12-{m.group(2)}",
        text,
    )
    return text


def read_resume_text(file, filename=None):
    name = (filename or getattr(file, "name", None) or str(file)).lower()

    try:
        # Seek to beginning if it's a file stream from Django
        if hasattr(file, "seek"):
            file.seek(0)

        if name.endswith(".docx"):
            document = Document(file)
            text = "".join(
                para.text.strip() + "\n"
                for para in document.paragraphs
                if para.text.strip()
            )
        elif name.endswith(".pdf"):
            reader = PdfReader(file)
            parts = []
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    parts.append(page_text)
            text = "\n".join(parts) + "\n" if parts else ""
        else:
            raise ResumeReadError("Unsupported file type (use .pdf or .docx)")
    except ResumeReadError:
        raise
    except Exception as exc:
        raise ResumeReadError(f"Could not read file: {exc}") from exc

    if not text.strip():
        raise ResumeReadError(
            "No text could be extracted (scanned or image-only file?)"
        )
    return normalize_dates(text)


def parse_job_description(jd_text, target_skills):
    """
    Returns {"keywords": set, "experience": str, "skill_lines": list}.
    Works on text (from the Job model), not on a file path.
    """
    content = (jd_text or "").lower()

    keywords = {s for s in target_skills if has_word(s.lower(), content)}

    def is_header(line, headers):
        return line.startswith(headers) and len(line) <= 40

    skill_lines, exp_lines = [], []
    in_experience = False
    in_skills = False

    for line in content.split("\n"):
        line = line.strip()
        if not line:
            continue

        if is_header(line, JD_EXP_HEADERS):
            in_experience, in_skills = True, False
            continue
        if is_header(line, JD_SKILLS_HEADERS):
            in_skills, in_experience = True, False
            continue
        if is_header(line, JD_OTHER_HEADERS):
            in_experience = in_skills = False
            continue

        if in_experience:
            exp_lines.append(line)
        if in_skills:
            skill_lines.append(line)

    return {
        "keywords": keywords,
        "experience": "\n".join(exp_lines),
        "skill_lines": skill_lines,
    }


def prepare_job(jd_text, target_skills=None, weights=None, must_have_skills=None, required_experience_years=0):
    skills = [
        s.strip().lower()
        for s in (target_skills or DEFAULT_TARGET_SKILLS)
        if s and s.strip()
    ]
    merged_weights = {**DEFAULT_WEIGHTS, **(weights or {})}
    profile = parse_job_description(jd_text, skills)
    profile["weights"] = merged_weights
    profile["target_skills"] = skills
    profile["must_have_skills"] = [s.strip().lower() for s in (must_have_skills or []) if s.strip()]
    profile["required_experience_years"] = float(required_experience_years or 0)
    return profile


def extract_information(text):
    email = "" 
    name = "" 
    linkedin_profile = ""
    github = "" 
    url = ""

    for line in text.split("\n")[:20]:
        has_email = re.search(EMAIL_PATTERN, line)
        has_linkedin = re.search(LINKEDIN_PATTERN, line)

        if (not name and not has_email and not has_linkedin
                and re.fullmatch(r"[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){1,3}",
                                 line.strip())):
            name = line.strip()
        if has_email and not email:
            email = has_email.group()
        if has_linkedin and not linkedin_profile:
            linkedin_profile = line.strip()
        if re.search(GITHUB_PATTERN, line) and not github:
            github = line.strip()
        m = re.search(URL_PATTERN, line)
        if m and not url:
            url = m.group()

    return {
        "name": name or "Unknown Candidate",
        "email": email,
        "linkedin": linkedin_profile,
        "github": github,
        "url": url,
    }


def detect_sections(text):
    sections = {"skills": [], "experience": [], "other": []}
    current_section = "other"

    for line in text.split("\n"):
        heading = clean_heading(line)

        if heading in EXPERIENCE_HEADINGS:
            current_section = "experience"
            continue
        if heading in SKILLS_HEADINGS:
            current_section = "skills"
            continue
        if heading in OTHER_HEADINGS:
            current_section = "other"
            continue

        sections[current_section].append(line)

    return sections


def get_location(header):
    m = LOCATION_PATTERN.search(header)
    if not m:
        return None
    return next((g.strip() for g in m.groups() if g), m.group())


def get_entries(experience_section, text):
    if isinstance(experience_section, list):
        experience_section = "\n".join(experience_section)

    source = experience_section if experience_section else text
    lines = [l.strip() for l in source.split("\n") if l.strip()]

    entries = []
    pending = []
    current = None

    for line in lines:
        is_bullet = line.lower().startswith(ACTION_VERBS) or detect_bullet_lines(line)

        date = find_date(line)
        if date:
            current = {
                "job_title": None,
                "company_name": None,
                "location": None,
                "date": date.group(),
                "responsibilities": [],
            }
            entries.append(current)

            for header in pending + [line]:
                title_match = JOB_PATTERN.search(header)
                if current["job_title"] is None and title_match:
                    current["job_title"] = title_match.group()
                if current["company_name"] is None and not title_match:
                    m = COMPANY_PATTERN.search(header)
                    if m:
                        current["company_name"] = m.group()
                if current["location"] is None:
                    current["location"] = get_location(header)

            pending = []
            continue

        if current is None:
            pending.append(line)
            continue

        if is_bullet:
            current["responsibilities"].append(line.lstrip("•-*●○ ").strip())
            continue

        if not current["responsibilities"]:
            title_match = JOB_PATTERN.search(line)
            if current["job_title"] is None and title_match:
                current["job_title"] = title_match.group()
            if current["company_name"] is None and not title_match:
                m = COMPANY_PATTERN.search(line)
                if m:
                    current["company_name"] = m.group()
            continue

        if JOB_PATTERN.search(line) or COMPANY_PATTERN.search(line):
            pending.append(line)
        else:
            if current["responsibilities"]:
                current["responsibilities"][-1] += " " + line
            else:
                current["responsibilities"].append(line)

    return entries


def calculate_experience_tenure(entries):
    """
    Extracts date ranges from parsed entries and computes total years of work experience.
    """
    total_months = 0
    date_regex = re.compile(r"(\d{2})-(\d{4})\s*[-–—]\s*(\d{2})-(\d{4})")

    for entry in entries:
        raw_date = entry.get("date", "")
        m = date_regex.search(raw_date)
        if m:
            start_m, start_y = int(m.group(1)), int(m.group(2))
            end_m, end_y = int(m.group(3)), int(m.group(4))
            span = (end_y - start_y) * 12 + (end_m - start_m)
            if span > 0:
                total_months += span

    return round(total_months / 12, 1)


def extract_skills(sections, job):
    max_points = job["weights"]["skills"]
    resume_skills_text = " ".join(sections["skills"]).lower()

    jd_skills_text = " ".join(job["skill_lines"]).lower()
    job_skills = [s.lower() for s in job["keywords"] if has_word(s.lower(), jd_skills_text)]
    if not job_skills:
        job_skills = [s.lower() for s in job["keywords"]]

    if not job_skills:
        return {"score": 0.0, "max": max_points, "matched": [], "missing": []}

    matched = [s for s in job_skills if has_word(s, resume_skills_text)]
    missing = [s for s in job_skills if s not in matched]
    percentage = len(matched) / len(job_skills) * 100

    return {
        "score": percentage * max_points / 100,
        "max": max_points,
        "matched": sorted(matched),
        "missing": sorted(missing),
    }

# Weights can be dynamically provided by the recruiters. If they do not ptovide, system uses default weights, skills=40, experience=40, keywords=20
def calculate_experience_score(entries, job):
    max_points = job["weights"]["experience"]
    jd_experience = job["experience"]
    resume_experience = "\n".join(
        resp for entry in entries for resp in entry["responsibilities"]
    )

    if not (jd_experience and resume_experience):
        return {"score": 0.0, "max": max_points, "similarity": 0.0}

    # If scikit-learn is available, use exact original logic:
    if TfidfVectorizer is not None and cosine_similarity is not None:
        vectorizer = TfidfVectorizer()
        try:
            jd_vector = vectorizer.fit_transform([jd_experience])
            resume_vector = vectorizer.transform([resume_experience])
            similarity = float(cosine_similarity(jd_vector, resume_vector)[0][0])
        except ValueError:
            similarity = 0.0
    else:
        
        words_jd = re.findall(r"\b\w+\b", jd_experience.lower())
        words_res = re.findall(r"\b\w+\b", resume_experience.lower())
        if not words_jd or not words_res:
            similarity = 0.0
        else:
            from collections import Counter
            c1 = Counter(words_jd)
            c2 = Counter(words_res)
            common = set(c1.keys()) & set(c2.keys())
            dot = sum(c1[w] * c2[w] for w in common)
            mag1 = math.sqrt(sum(v**2 for v in c1.values()))
            mag2 = math.sqrt(sum(v**2 for v in c2.values()))
            similarity = dot / (mag1 * mag2) if (mag1 > 0 and mag2 > 0) else 0.0

    return {
        "score": round(similarity * max_points, 2),
        "max": max_points,
        "similarity": round(similarity, 4)
    }


def calculate_keyword_overlap(job, text):
    max_points = job["weights"]["keywords"]
    keywords = job["keywords"]
    text = text.lower()

    matched = [k for k in keywords if has_word(k.lower(), text)]
    missing = [k for k in keywords if k not in matched]
    score = (len(matched) / len(keywords)) * max_points if keywords else 0.0

    return {
        "score": round(score, 2),
        "max": max_points,
        "matched": sorted(matched),
        "missing": sorted(missing),
    }


def screen_resume(file, job, filename=None):
    raw_text = read_resume_text(file, filename)

    sections = detect_sections(raw_text)
    entries = get_entries(sections["experience"], raw_text)

    skills = extract_skills(sections, job)
    experience = calculate_experience_score(entries, job)
    keywords = calculate_keyword_overlap(job, raw_text)

    # Years of experience calculation
    actual_years = calculate_experience_tenure(entries)
    required_years = job.get("required_experience_years", 0)
    experience_gap = round(actual_years - required_years, 1)

    # Required / Must-Have vs Nice-to-Have
    must_have_list = job.get("must_have_skills", [])
    # Check across whole text + skills section
    text_lower = raw_text.lower()
    missing_must_have = [
        s for s in must_have_list
        if not (has_word(s.lower(), text_lower))
    ]

    # Parsing-quality warnings
    warnings = []
    if not sections["skills"]:
        warnings.append("No skills section detected")
    if not sections["experience"]:
        warnings.append("No experience heading detected; searched the full text")
    if not entries:
        warnings.append("No job entries detected")
    elif not any(e["responsibilities"] for e in entries):
        warnings.append("Job entries found but no responsibilities extracted")
    if missing_must_have:
        warnings.append(f"Missing must-have skill(s): {', '.join(missing_must_have)}")
    if required_years > 0 and actual_years < required_years:
        warnings.append(f"Experience below requirement ({actual_years} yrs vs {required_years} yrs required)")

    total = skills["score"] + experience["score"] + keywords["score"]

    return {
        "candidate": extract_information(raw_text),
        "total_score": round(total, 2),
        "skills_score": round(skills["score"], 2),
        "experience_score": round(experience["score"], 2),
        "keywords_score": round(keywords["score"], 2),
        "years_of_experience": actual_years,
        "required_experience": required_years,
        "experience_gap": experience_gap,
        "max_scores": {
            "skills": skills["max"],
            "experience": experience["max"],
            "keywords": keywords["max"],
            "total": skills["max"] + experience["max"] + keywords["max"],
        },
        "matched_skills": skills["matched"],
        "missing_skills": skills["missing"],
        "missing_must_have": missing_must_have,
        "matched_keywords": keywords["matched"],
        "missing_keywords": keywords["missing"],
        "entries": entries,
        "warnings": warnings,
        "raw_text": raw_text,
    }
