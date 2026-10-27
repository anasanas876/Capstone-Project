from django.db import models


class Job(models.Model):
    title = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255, blank=True, default="")
    description = models.TextField(help_text="Typed or pasted job description text")
    required_experience_years = models.FloatField(default=0.0)
    target_skills = models.JSONField(default=list, blank=True)
    must_have_skills = models.JSONField(default=list, blank=True)
    weights = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ["-created_at"]


class Candidate(models.Model):
    STATUS_CHOICES = [
        ("APPLIED", "Applied"),
        ("IN_PROGRESS", "In Progress"),
        ("HIRED", "Hired"),
        ("REJECTED", "Rejected"),
    ]

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="candidates")
    name = models.CharField(max_length=255, default="Unknown Candidate")
    email = models.CharField(max_length=255, blank=True, default="")
    phone = models.CharField(max_length=50, blank=True, default="")
    linkedin = models.CharField(max_length=255, blank=True, default="")
    github = models.CharField(max_length=255, blank=True, default="")
    portfolio_url = models.CharField(max_length=255, blank=True, default="")
    resume_file = models.FileField(upload_to="resumes/", null=True, blank=True)
    
    # Kanban Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="APPLIED")

    # Scores
    total_score = models.FloatField(default=0.0)
    skills_score = models.FloatField(default=0.0)
    experience_score = models.FloatField(default=0.0)
    keywords_score = models.FloatField(default=0.0)
    years_of_experience = models.FloatField(default=0.0)
    
    # Detailed Analysis
    matched_skills = models.JSONField(default=list, blank=True)
    missing_skills = models.JSONField(default=list, blank=True)
    missing_must_have = models.JSONField(default=list, blank=True)
    matched_keywords = models.JSONField(default=list, blank=True)
    missing_keywords = models.JSONField(default=list, blank=True)
    entries = models.JSONField(default=list, blank=True)
    warnings = models.JSONField(default=list, blank=True)
    raw_text = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.total_score}%) - {self.status}"

    class Meta:
        ordering = ["-total_score", "-created_at"]


class CandidateNote(models.Model):
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name="notes")
    author = models.CharField(max_length=100, default="Recruiter")
    content = models.TextField()
    rating = models.IntegerField(null=True, blank=True) # 1-5 rating
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Note by {self.author} on {self.candidate.name}"

    class Meta:
        ordering = ["-created_at"]


class UserProfile(models.Model):
    ROLE_CHOICES = [
        ("RECRUITER", "Recruiter"),
        ("REVIEWER", "Reviewer"),
    ]
    user = models.OneToOneField("auth.User", on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="RECRUITER")

    def __str__(self):
        return f"{self.user.username} ({self.role})"
