from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

router = DefaultRouter()
router.register(r'scholarships', views.ScholarshipViewSet, basename='scholarship')
router.register(r'applications', views.ApplicationViewSet, basename='application')
router.register(r'documents', views.VaultDocumentViewSet, basename='document')
router.register(r'notifications', views.NotificationViewSet, basename='notification')

urlpatterns = [
    # Auth
    path('auth/register/', views.RegisterView.as_view(), name='register'),
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/me/', views.MeView.as_view(), name='me'),
    path('auth/password/', views.ChangePasswordView.as_view(), name='change-password'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),

    # Matches (flat list for the logged-in user)
    path('matches/', views.MatchListView.as_view(), name='matches'),

    # Notifications bulk action
    path('notifications/mark-all-read/', views.mark_all_read, name='mark-all-read'),

    # AI assistant (Groq-backed, grounded in the student's data)
    path('assistant/chat/', views.assistant_chat, name='assistant-chat'),

    # Admin (staff only)
    path('admin/stats/', views.AdminStatsView.as_view(), name='admin-stats'),
    path('admin/applications/', views.AdminApplicationsView.as_view(), name='admin-applications'),
    path('admin/scholarships/', views.AdminScholarshipCreateView.as_view(), name='admin-scholarship-create'),

    # Reference data
    path('reference/', views.reference_data, name='reference'),

    # Router-generated CRUD
    path('', include(router.urls)),
]
