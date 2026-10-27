#!/usr/bin/env python
import os
import sys
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.core.mail import send_mail
from django.conf import settings


def test_smtp_delivery(recipient_email):
    print("=" * 60)
    print("RECRUITER PLATFORM - SMTP CONNECTION TEST")
    print("=" * 60)
    print(f"  EMAIL_HOST          : {settings.EMAIL_HOST}")
    print(f"  EMAIL_PORT          : {settings.EMAIL_PORT}")
    print(f"  EMAIL_USE_TLS       : {settings.EMAIL_USE_TLS}")
    print(f"  EMAIL_HOST_USER     : {settings.EMAIL_HOST_USER or '(Not set - edit backend/.env)'}")
    print(f"  DEFAULT_FROM_EMAIL  : {settings.DEFAULT_FROM_EMAIL}")
    print(f"  TEST RECIPIENT      : {recipient_email}")
    print("-" * 60)

    if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
        print("[!] WARNING: EMAIL_HOST_USER or EMAIL_HOST_PASSWORD is empty.")
        print("    Please edit 'backend/.env' with your credentials first.")
        print("=" * 60)
        return False

    print("Attempting to connect to SMTP server and dispatch test message...")
    try:
        send_mail(
            subject="Recruiter Platform: SMTP Test Email",
            message=(
                "Congratulations!\n\n"
                "Your SMTP configuration on the Recruiter Platform is working correctly.\n"
                "You can now send interview invitations, offers, and candidate updates "
                "directly from the Next.js candidate profile pages."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient_email],
            fail_silently=False,
        )
        print("[+] SUCCESS: Test email delivered successfully to candidate inbox!")
        print("=" * 60)
        return True
    except Exception as exc:
        print(f"[-] FAILED: SMTP delivery error: {exc}")
        print("=" * 60)
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_email.py <recipient_email>")
        print("Example: python test_email.py myemail@gmail.com")
    else:
        test_smtp_delivery(sys.argv[1].strip())
