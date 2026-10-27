import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Avg, Count
from django.shortcuts import get_object_or_404

from .models import Job, Candidate, CandidateNote
from .serializers import JobSerializer, CandidateSerializer, CandidateListSerializer
from .engine import (
    prepare_job,
    screen_resume,
    parse_job_description,
    ResumeReadError,
    DEFAULT_TARGET_SKILLS,
    DEFAULT_WEIGHTS
)

logger = logging.getLogger(__name__)


class JobViewSet(viewsets.ModelViewSet):
    queryset = Job.objects.prefetch_related("candidates").all().order_by("-created_at")
    serializer_class = JobSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        
        # If target skills not provided, auto-extract from JD or fallback to defaults
        target_skills = data.get("target_skills")
        if not target_skills:
            parsed = parse_job_description(data.get("description", ""), DEFAULT_TARGET_SKILLS)
            extracted = list(parsed["keywords"])
            data["target_skills"] = extracted if extracted else DEFAULT_TARGET_SKILLS

        if not data.get("weights"):
            data["weights"] = DEFAULT_WEIGHTS

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="extract-skills")
    def extract_skills_from_jd(self, request):
        """Allows recruiter to preview extracted skills from pasted JD before saving."""
        jd_text = request.data.get("description", "")
        custom_pool = request.data.get("target_skills", DEFAULT_TARGET_SKILLS)
        parsed = parse_job_description(jd_text, custom_pool)
        return Response({
            "keywords": sorted(list(parsed["keywords"])),
            "skill_lines": parsed["skill_lines"],
            "has_experience_section": bool(parsed["experience"])
        })

    @action(detail=True, methods=["post"], url_path="upload-resumes")
    def upload_resumes(self, request, pk=None):
        import io
        import os
        import zipfile

        job = self.get_object()
        raw_files = request.FILES.getlist("resumes") or request.FILES.getlist("files")

        if not raw_files:
            return Response(
                {"error": "No resume files uploaded. Please attach PDF, DOCX, or a ZIP archive containing resumes."},
                status=status.HTTP_400_BAD_REQUEST
            )

        job_profile = prepare_job(
            jd_text=job.description,
            target_skills=job.target_skills,
            weights=job.weights,
            must_have_skills=job.must_have_skills,
            required_experience_years=job.required_experience_years
        )

        results = []
        errors = []

        # Expand files (handling ZIP archives containing multiple resumes)
        files_to_process = []
        for f in raw_files:
            fname = f.name.lower()
            if fname.endswith(".zip"):
                try:
                    with zipfile.ZipFile(f) as z:
                        for member in z.infolist():
                            if not member.is_dir() and member.filename.lower().endswith((".pdf", ".docx")):
                                extracted_bytes = z.read(member.filename)
                                base_name = os.path.basename(member.filename)
                                files_to_process.append((io.BytesIO(extracted_bytes), base_name))
                except Exception as zip_err:
                    errors.append({"filename": f.name, "error": f"Failed to extract zip file: {zip_err}"})
            elif fname.endswith((".pdf", ".docx")):
                files_to_process.append((f, f.name))
            else:
                errors.append({"filename": f.name, "error": "Unsupported file format. Please upload .pdf, .docx, or .zip"})

        for file_obj, filename in files_to_process:
            try:
                screening_result = screen_resume(
                    file=file_obj,
                    job=job_profile,
                    filename=filename
                )

                candidate_info = screening_result["candidate"]
                
                candidate = Candidate.objects.create(
                    job=job,
                    name=candidate_info.get("name") or filename,
                    email=candidate_info.get("email", ""),
                    linkedin=candidate_info.get("linkedin", ""),
                    github=candidate_info.get("github", ""),
                    portfolio_url=candidate_info.get("url", ""),
                    resume_file=file_obj if hasattr(file_obj, "chunks") else None,
                    total_score=screening_result["total_score"],
                    skills_score=screening_result["skills_score"],
                    experience_score=screening_result["experience_score"],
                    keywords_score=screening_result["keywords_score"],
                    years_of_experience=screening_result["years_of_experience"],
                    matched_skills=screening_result["matched_skills"],
                    missing_skills=screening_result["missing_skills"],
                    missing_must_have=screening_result["missing_must_have"],
                    matched_keywords=screening_result["matched_keywords"],
                    missing_keywords=screening_result["missing_keywords"],
                    entries=screening_result["entries"],
                    warnings=screening_result["warnings"],
                    raw_text=screening_result["raw_text"]
                )

                results.append(CandidateListSerializer(candidate).data)

            except ResumeReadError as r_err:
                errors.append({"filename": filename, "error": str(r_err)})
            except Exception as exc:
                logger.exception("Error processing %s", filename)
                errors.append({"filename": filename, "error": f"Internal parsing error: {exc}"})

        return Response({
            "message": f"Successfully processed {len(results)} resumes. {len(errors)} failed/skipped.",
            "processed_count": len(results),
            "failed_count": len(errors),
            "candidates": results,
            "errors": errors
        }, status=status.HTTP_200_OK if results else status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="rescore")
    def rescore_candidates(self, request, pk=None):
        """Re-scores all existing candidates when the job description, skills, or weights are edited."""
        import io
        job = self.get_object()
        candidates = job.candidates.all()
        job_profile = prepare_job(
            jd_text=job.description,
            target_skills=job.target_skills,
            weights=job.weights,
            must_have_skills=job.must_have_skills,
            required_experience_years=job.required_experience_years
        )

        updated_count = 0
        for cand in candidates:
            if not cand.raw_text:
                continue
            # Re-screen using stored raw_text
            res_stream = io.StringIO(cand.raw_text)
            # Recompute directly using sections and entries
            from .engine import detect_sections, get_entries, extract_skills, calculate_experience_score, calculate_keyword_overlap, calculate_experience_tenure, has_word
            
            sections = detect_sections(cand.raw_text)
            entries = get_entries(sections["experience"], cand.raw_text)
            skills = extract_skills(sections, job_profile)
            experience = calculate_experience_score(entries, job_profile)
            keywords = calculate_keyword_overlap(job_profile, cand.raw_text)
            actual_years = calculate_experience_tenure(entries)
            required_years = job_profile.get("required_experience_years", 0)

            must_have_list = job_profile.get("must_have_skills", [])
            text_lower = cand.raw_text.lower()
            missing_must_have = [s for s in must_have_list if not has_word(s.lower(), text_lower)]

            total = skills["score"] + experience["score"] + keywords["score"]

            cand.total_score = round(total, 2)
            cand.skills_score = round(skills["score"], 2)
            cand.experience_score = round(experience["score"], 2)
            cand.keywords_score = round(keywords["score"], 2)
            cand.years_of_experience = actual_years
            cand.matched_skills = skills["matched"]
            cand.missing_skills = skills["missing"]
            cand.missing_must_have = missing_must_have
            cand.matched_keywords = keywords["matched"]
            cand.missing_keywords = keywords["missing"]
            cand.save()
            updated_count += 1

        return Response({"message": f"Successfully rescored {updated_count} candidates.", "updated_count": updated_count})

    @action(detail=True, methods=["get"], url_path="candidates")
    def list_candidates(self, request, pk=None):
        job = self.get_object()
        candidates = job.candidates.all()

        # Filter by Minimum Overall Score
        min_score = request.query_params.get("min_score")
        if min_score:
            try:
                candidates = candidates.filter(total_score__gte=float(min_score))
            except ValueError:
                pass

        # Filter by Minimum Experience Years
        min_exp = request.query_params.get("min_experience")
        if min_exp:
            try:
                candidates = candidates.filter(years_of_experience__gte=float(min_exp))
            except ValueError:
                pass

        # Filter: Meets Required Experience
        meets_exp = request.query_params.get("meets_required_exp")
        if meets_exp in ["true", "1"] and job.required_experience_years > 0:
            candidates = candidates.filter(years_of_experience__gte=job.required_experience_years)

        # Filter: Search query
        search = request.query_params.get("search")
        if search:
            candidates = candidates.filter(name__icontains=search)

        # Filter: Qualified Only (Must-Have skills met)
        qualified_only = request.query_params.get("qualified_only")
        if qualified_only in ["true", "1"]:
            candidates = [c for c in candidates if len(c.missing_must_have) == 0]

        # Filter by Status (Kanban stage)
        status_filter = request.query_params.get("status")
        if status_filter:
            candidates = candidates.filter(status=status_filter)

        # Filter: Specific Skill Match
        has_skill = request.query_params.get("has_skill")
        if has_skill:
            skill_target = has_skill.strip().lower()
            candidates = [
                c for c in candidates
                if skill_target in [s.lower() for s in (c.matched_skills or [])]
                or skill_target in [k.lower() for k in (c.matched_keywords or [])]
            ]

        # Ordering
        ordering = request.query_params.get("ordering", "-total_score")
        if isinstance(candidates, list):
            reverse = ordering.startswith("-")
            key_field = ordering.lstrip("-")
            candidates.sort(key=lambda x: getattr(x, key_field, 0) or 0, reverse=reverse)
            serializer = CandidateListSerializer(candidates, many=True)
        else:
            candidates = candidates.order_by(ordering)
            serializer = CandidateListSerializer(candidates, many=True)

        return Response(serializer.data)


class CandidateViewSet(viewsets.ModelViewSet):
    queryset = Candidate.objects.select_related("job").prefetch_related("notes").all()
    serializer_class = CandidateSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=["patch", "post"], url_path="update-status")
    def update_status(self, request, pk=None):
        candidate = self.get_object()
        new_status = request.data.get("status")
        valid_statuses = [choice[0] for choice in Candidate.STATUS_CHOICES]
        
        if new_status not in valid_statuses:
            return Response(
                {"error": f"Invalid status: {new_status}. Allowed values: {valid_statuses}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        old_status = candidate.get_status_display()
        candidate.status = new_status
        candidate.save()

        from .models import CandidateNote
        CandidateNote.objects.create(
            candidate=candidate,
            author="System",
            content=f"Candidate stage updated from {old_status} to {candidate.get_status_display()}."
        )

        return Response(CandidateSerializer(candidate).data)

    @action(detail=True, methods=["post"], url_path="add-note")
    def add_note(self, request, pk=None):
        candidate = self.get_object()
        content = request.data.get("content", "").strip()
        if not content:
            return Response({"error": "Review/note content cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

        author = request.data.get("author", "Recruiter").strip() or "Recruiter"
        rating = request.data.get("rating")
        if rating is not None:
            try:
                rating = int(rating)
            except ValueError:
                rating = None

        from .models import CandidateNote
        from .serializers import CandidateNoteSerializer
        note = CandidateNote.objects.create(
            candidate=candidate,
            author=author,
            content=content,
            rating=rating
        )
        return Response(CandidateNoteSerializer(note).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="send-email")
    def send_email(self, request, pk=None):
        from django.core.mail import send_mail
        from django.conf import settings
        from .models import CandidateNote

        candidate = self.get_object()
        if not candidate.email:
            return Response(
                {"error": "Candidate does not have a detected email address."},
                status=status.HTTP_400_BAD_REQUEST
            )

        subject = request.data.get("subject", "").strip()
        body = request.data.get("body", "").strip()

        if not subject or not body:
            return Response(
                {"error": "Subject and email body are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or "recruiter@platform.com"

        try:
            send_mail(
                subject=subject,
                message=body,
                from_email=from_email,
                recipient_list=[candidate.email],
                fail_silently=False,
            )

            # Record in candidate activity notes
            CandidateNote.objects.create(
                candidate=candidate,
                author="Recruiter (Email Dispatch)",
                content=f"Sent email: \"{subject}\"\n\n{body}"
            )

            return Response({
                "success": True,
                "message": f"Email successfully delivered to {candidate.email}."
            }, status=status.HTTP_200_OK)

        except Exception as exc:
            logger.exception("Failed to send email to %s", candidate.email)
            return Response({
                "error": f"Failed to deliver email via SMTP: {exc}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def destroy(self, request, *args, **kwargs):
        candidate = get_object_or_404(Candidate, pk=kwargs.get("pk"))
        candidate.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    total_jobs = Job.objects.count()
    total_candidates = Candidate.objects.count()
    avg_score = Candidate.objects.aggregate(Avg("total_score"))["total_score__avg"] or 0.0
    
    top_candidates = Candidate.objects.order_by("-total_score")[:5]
    recent_jobs = Job.objects.order_by("-created_at")[:5]

    return Response({
        "total_jobs": total_jobs,
        "total_candidates": total_candidates,
        "average_score": round(avg_score, 1),
        "top_candidates": CandidateListSerializer(top_candidates, many=True).data,
        "recent_jobs": JobSerializer(recent_jobs, many=True).data
    })
