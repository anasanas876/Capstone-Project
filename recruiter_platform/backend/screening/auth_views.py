import logging
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import UserProfile

logger = logging.getLogger(__name__)


def get_tokens_for_user(user):
    """Generate simple JWT access and refresh tokens for a user."""
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


def serialize_user(user):
    """Serialize basic user data and attached role."""
    role = "RECRUITER"
    if hasattr(user, "profile"):
        role = user.profile.role
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": role,
    }


class SignupView(APIView):
    """
    POST /api/auth/signup/
    Registers a new recruiter or reviewer account and returns a JWT access token.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username", "").strip()
        email = request.data.get("email", "").strip().lower()
        password = request.data.get("password", "")
        role = request.data.get("role", "RECRUITER").strip().upper()

        if not username or not password:
            return Response(
                {"error": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(password) < 6:
            return Response(
                {"error": "Password must be at least 6 characters long."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(username__iexact=username).exists():
            return Response(
                {"error": f"Username '{username}' is already taken."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if email and User.objects.filter(email__iexact=email).exists():
            return Response(
                {"error": f"An account with email '{email}' already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if role not in ["RECRUITER", "REVIEWER"]:
            role = "RECRUITER"

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
        )

        UserProfile.objects.create(user=user, role=role)
        tokens = get_tokens_for_user(user)

        return Response(
            {
                "message": "Account created successfully.",
                "tokens": tokens,
                "user": serialize_user(user),
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    """
    POST /api/auth/login/
    Validates username/email and password, returning 7-day JWT tokens.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        identifier = request.data.get("username", "").strip()
        password = request.data.get("password", "")

        if not identifier or not password:
            return Response(
                {"error": "Username/email and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Allow logging in with either username or email
        user = authenticate(username=identifier, password=password)
        if not user and "@" in identifier:
            try:
                matched_user = User.objects.get(email__iexact=identifier)
                user = authenticate(username=matched_user.username, password=password)
            except (User.DoesNotExist, User.MultipleObjectsReturned):
                user = None

        if not user:
            return Response(
                {"error": "Invalid credentials. Please verify your username and password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Ensure user profile exists
        if not hasattr(user, "profile"):
            UserProfile.objects.create(user=user, role="RECRUITER")

        tokens = get_tokens_for_user(user)

        return Response(
            {
                "message": "Login successful.",
                "tokens": tokens,
                "user": serialize_user(user),
            },
            status=status.HTTP_200_OK,
        )


class MeView(APIView):
    """
    GET /api/auth/me/
    Returns the authenticated user's profile and permissions.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "user": serialize_user(request.user)
        })
