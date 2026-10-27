from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

def api_root(request):
    return JsonResponse({
        "name": "Recruiter Platform REST API",
        "version": "1.0.0",
        "frontend": "http://localhost:3000",
        "documentation": "Use the Next.js frontend at http://localhost:3000 to interact with the platform.",
        "endpoints": {
            "jobs": "/api/jobs/",
            "candidates": "/api/candidates/",
            "stats": "/api/dashboard/stats/",
            "ai_insights": "/api/candidates/<id>/ai-insights/"
        }
    })

urlpatterns = [
    path('', api_root, name='api-root'),
    path('admin/', admin.site.urls),
    path('api/', include('screening.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
