from rest_framework import serializers
from .models import Job, Candidate, CandidateNote


class CandidateNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = CandidateNote
        fields = ["id", "author", "content", "rating", "created_at"]


class CandidateSerializer(serializers.ModelSerializer):
    notes = CandidateNoteSerializer(many=True, read_only=True)
    job_title = serializers.CharField(source="job.title", read_only=True)
    job_required_experience = serializers.FloatField(source="job.required_experience_years", read_only=True)

    class Meta:
        model = Candidate
        fields = "__all__"


class CandidateListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Candidate
        fields = [
            "id", "job", "name", "email", "phone", "linkedin", "github", "portfolio_url",
            "status", "total_score", "skills_score", "experience_score", "keywords_score",
            "years_of_experience", "matched_skills", "missing_skills",
            "missing_must_have", "matched_keywords", "missing_keywords",
            "warnings", "created_at"
        ]


class JobSerializer(serializers.ModelSerializer):
    candidate_count = serializers.SerializerMethodField()
    top_score = serializers.SerializerMethodField()
    avg_score = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = [
            "id", "title", "company_name", "description",
            "required_experience_years", "target_skills",
            "must_have_skills", "weights", "created_at", "updated_at",
            "candidate_count", "top_score", "avg_score"
        ]

    def get_candidate_count(self, obj):
        return obj.candidates.count()

    def get_top_score(self, obj):
        top = obj.candidates.first() # Ordered by -total_score
        return top.total_score if top else 0.0

    def get_avg_score(self, obj):
        from django.db.models import Avg
        res = obj.candidates.aggregate(Avg("total_score"))["total_score__avg"]
        return round(res, 1) if res else 0.0
