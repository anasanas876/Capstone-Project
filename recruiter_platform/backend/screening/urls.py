from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import JobViewSet, CandidateViewSet, dashboard_stats
from .ai_views import CandidateAiInsightsView
from .auth_views import SignupView, LoginView, MeView
from rest_framework_simplejwt.views import TokenRefreshView

router = DefaultRouter()
router.register(r"jobs", JobViewSet, basename="job")
router.register(r"candidates", CandidateViewSet, basename="candidate")

urlpatterns = [
    # Authentication & User Management (JWT)
    path("auth/signup/", SignupView.as_view(), name="auth-signup"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),

    # Recruiter Features
    path("dashboard/stats/", dashboard_stats, name="dashboard-stats"),
    path("candidates/<int:candidate_id>/ai-insights/", CandidateAiInsightsView.as_view(), name="candidate-ai-insights"),
    path("", include(router.urls)),
]
