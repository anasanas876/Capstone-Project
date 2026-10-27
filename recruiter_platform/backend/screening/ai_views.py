from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.shortcuts import get_object_or_404

from .models import Candidate
from .ai_service import get_candidate_ai_insights


class CandidateAiInsightsView(APIView):
    """
    REST API endpoint for candidate AI insights:
    POST /api/candidates/<candidate_id>/ai-insights/
    GET  /api/candidates/<candidate_id>/ai-insights/
    """
    permission_classes = [IsAuthenticated]
    def get(self, request, candidate_id):
        candidate = get_object_or_404(Candidate, pk=candidate_id)
        job = candidate.job
        result = get_candidate_ai_insights(candidate, job)
        return Response(result, status=status.HTTP_200_OK if result.get("success") else status.HTTP_200_OK)

    def post(self, request, candidate_id):
        candidate = get_object_or_404(Candidate, pk=candidate_id)
        job = candidate.job
        result = get_candidate_ai_insights(candidate, job)
        return Response(result, status=status.HTTP_200_OK if result.get("success") else status.HTTP_200_OK)
