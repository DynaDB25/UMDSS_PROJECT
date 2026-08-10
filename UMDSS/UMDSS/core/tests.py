"""Tests for the notification delivery layer.

The guardrails matter more than the happy path here: every one of them stands
between a bug and either a prepaid SMS balance or a 300-a-day email allowance,
and none of them is exercised by clicking around the app.
"""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from core.checks import delivery_backends_are_configured
from core.mailer.backends import BrevoEmailBackend, render_html
from core.models import (Application, MatchResult, Notification, OutboundMessage,
                         Scholarship, StudentProfile)
from core.notifications import notify
from core.sms import send_sms, to_e164
from core.mailer import send_email
from core.sms.backends import ArkeselSmsBackend

# Both channels on, console providers, and quiet hours pinned off so results
# never depend on what time the suite happens to run.
DELIVERY_SETTINGS = dict(
    SMS_ENABLED=True, SMS_BACKEND='console', SMS_DAILY_CAP=100,
    SMS_QUIET_HOURS_START=0, SMS_QUIET_HOURS_END=0,
    EMAIL_ENABLED=True, EMAIL_PROVIDER='console', EMAIL_DAILY_CAP=100,
)


def make_student(username='ama', phone='0244123456', email='ama@example.com',
                 sms_opt_in=True, email_opt_in=True, profile=True):
    user = User.objects.create_user(username=username, password='pw', email=email)
    if profile:
        StudentProfile.objects.create(
            user=user, phone=phone, sms_opt_in=sms_opt_in, email_opt_in=email_opt_in)
    return user


def make_scholarship(slug='mcf', deadline_in_days=7, **kwargs):
    fields = {
        'slug': slug,
        'name': 'Mastercard Foundation Scholars Program',
        'provider': 'Mastercard Foundation',
        'provider_type': 'Foundation',
        'initials': 'MF',
        'amount': 'Full tuition',
        'deadline': timezone.localdate() + timedelta(days=deadline_in_days),
    }
    fields.update(kwargs)
    return Scholarship.objects.create(**fields)


def fake_response(status_code=200, payload=None, text=''):
    response = type('R', (), {})()
    response.status_code = status_code
    response.text = text
    response.json = lambda: (
        payload if payload is not None else (_ for _ in ()).throw(ValueError()))
    return response


class PhoneNormalisationTests(TestCase):
    def test_accepts_the_shapes_students_actually_type(self):
        cases = {
            '0244123456': '+233244123456',
            '024 412 3456': '+233244123456',
            '024-412-3456': '+233244123456',
            '+233 24 412 3456': '+233244123456',
            '233244123456': '+233244123456',
            '00233244123456': '+233244123456',
            '244123456': '+233244123456',
            '0544123456': '+233544123456',
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(to_e164(raw), expected)

    def test_rejects_anything_it_cannot_vouch_for(self):
        for raw in ['', None, '   ', 'not a number', '0302123456', '024412345',
                    '02441234567', '+1 415 555 0100']:
            with self.subTest(raw=raw):
                self.assertIsNone(to_e164(raw))

    def test_glo_number_typed_without_its_leading_zero(self):
        """``233123456`` is a national Glo number, not a country code plus six.

        The country code and the 023 prefix collide, which is exactly why the
        normaliser tries every reading instead of stripping the first match.
        """
        self.assertEqual(to_e164('233123456'), '+233233123456')


@override_settings(**DELIVERY_SETTINGS)
class SmsGuardrailTests(TestCase):
    def test_console_backend_records_a_send(self):
        message = send_sms(make_student(), 'hello')
        self.assertEqual(message.status, 'Sent')
        self.assertEqual(message.channel, 'SMS')
        self.assertEqual(message.recipient, '+233244123456')

    def test_opted_out_student_is_skipped(self):
        message = send_sms(make_student(sms_opt_in=False), 'hello')
        self.assertEqual(message.status, 'Skipped')
        self.assertIn('opted out', message.error)

    def test_student_without_a_profile_is_skipped(self):
        self.assertEqual(send_sms(make_student(profile=False), 'hi').status, 'Skipped')

    def test_unusable_number_is_skipped_rather_than_sent(self):
        message = send_sms(make_student(phone='ring me'), 'hello')
        self.assertEqual(message.status, 'Skipped')
        self.assertIn('unusable', message.error)

    @override_settings(SMS_ENABLED=False)
    def test_master_switch_stops_everything(self):
        self.assertEqual(send_sms(make_student(), 'hello').status, 'Skipped')

    @override_settings(SMS_QUIET_HOURS_START=0, SMS_QUIET_HOURS_END=24)
    def test_quiet_hours_suppress_the_send(self):
        message = send_sms(make_student(), 'hello')
        self.assertEqual(message.status, 'Skipped')
        self.assertIn('quiet hours', message.error)

    @override_settings(SMS_QUIET_HOURS_START=0, SMS_QUIET_HOURS_END=24)
    def test_quiet_hours_can_be_overridden_for_a_student_initiated_action(self):
        self.assertEqual(
            send_sms(make_student(), 'hi', ignore_quiet_hours=True).status, 'Sent')

    @override_settings(SMS_DAILY_CAP=0)
    def test_daily_cap_is_a_hard_stop(self):
        message = send_sms(make_student(), 'hello')
        self.assertEqual(message.status, 'Skipped')
        self.assertIn('cap', message.error)

    @override_settings(SMS_MAX_LENGTH=40)
    def test_overlong_message_is_trimmed_to_one_segment(self):
        message = send_sms(make_student(), 'x' * 100)
        self.assertEqual(len(message.body), 40)
        self.assertTrue(message.body.endswith('...'))

    def test_dedupe_key_allows_exactly_one_send(self):
        student = make_student()
        first = send_sms(student, 'hello', dedupe_key='deadline:1:2:7')
        second = send_sms(student, 'hello again', dedupe_key='deadline:1:2:7')

        self.assertEqual(first.pk, second.pk)
        self.assertEqual(OutboundMessage.objects.filter(channel='SMS').count(), 1)

    @override_settings(SMS_ENABLED=False)
    def test_a_skip_does_not_burn_the_dedupe_key(self):
        """Turning SMS off must not permanently consume the event's key.

        Otherwise switching the gateway on later would find every event already
        marked as handled and silently send nothing, ever.
        """
        student = make_student()
        skipped = send_sms(student, 'hello', dedupe_key='deadline:1:2:7')
        self.assertEqual(skipped.status, 'Skipped')
        self.assertEqual(skipped.dedupe_key, '')

        with override_settings(SMS_ENABLED=True):
            retried = send_sms(student, 'hello', dedupe_key='deadline:1:2:7')
        self.assertEqual(retried.status, 'Sent')


@override_settings(**DELIVERY_SETTINGS)
class EmailGuardrailTests(TestCase):
    def test_console_backend_records_a_send(self):
        message = send_email(make_student(), 'Subject', 'Body')
        self.assertEqual(message.status, 'Sent')
        self.assertEqual(message.channel, 'Email')
        self.assertEqual(message.recipient, 'ama@example.com')

    def test_opted_out_student_is_skipped(self):
        message = send_email(make_student(email_opt_in=False), 'S', 'B')
        self.assertEqual(message.status, 'Skipped')
        self.assertIn('opted out', message.error)

    def test_malformed_address_is_skipped_rather_than_sent(self):
        message = send_email(make_student(email='not-an-address'), 'S', 'B')
        self.assertEqual(message.status, 'Skipped')
        self.assertIn('unusable', message.error)

    def test_account_with_no_address_is_skipped(self):
        self.assertEqual(send_email(make_student(email=''), 'S', 'B').status, 'Skipped')

    @override_settings(EMAIL_ENABLED=False)
    def test_master_switch_stops_everything(self):
        self.assertEqual(send_email(make_student(), 'S', 'B').status, 'Skipped')

    @override_settings(EMAIL_DAILY_CAP=0)
    def test_daily_cap_guards_the_free_plan_allowance(self):
        message = send_email(make_student(), 'S', 'B')
        self.assertEqual(message.status, 'Skipped')
        self.assertIn('cap', message.error)

    @override_settings(SMS_QUIET_HOURS_START=0, SMS_QUIET_HOURS_END=24)
    def test_quiet_hours_do_not_apply_to_email(self):
        """An unread inbox message wakes nobody, so the window is SMS-only."""
        self.assertEqual(send_email(make_student(), 'S', 'B').status, 'Sent')

    def test_dedupe_key_allows_exactly_one_send(self):
        student = make_student()
        first = send_email(student, 'S', 'B', dedupe_key='match:1:2')
        second = send_email(student, 'S', 'B', dedupe_key='match:1:2')

        self.assertEqual(first.pk, second.pk)
        self.assertEqual(OutboundMessage.objects.filter(channel='Email').count(), 1)

    def test_the_same_key_is_free_on_the_other_channel(self):
        """One event must be able to reach a student by both SMS and email."""
        student = make_student()
        send_sms(student, 'short form', dedupe_key='deadline:1:2:7')
        emailed = send_email(student, 'S', 'B', dedupe_key='deadline:1:2:7')

        self.assertEqual(emailed.status, 'Sent')
        self.assertEqual(OutboundMessage.objects.count(), 2)


@override_settings(**DELIVERY_SETTINGS)
class NotifyFanOutTests(TestCase):
    def test_channel_says_sms_when_both_land(self):
        student = make_student()
        notification, delivery = notify(
            student, category='Deadline', title='t', body='b',
            sms_text='text', email=True)

        self.assertEqual(delivery.sms.status, 'Sent')
        self.assertEqual(delivery.email.status, 'Sent')
        # SMS wins the label: it is the one the student most likely saw.
        self.assertEqual(notification.channel, 'SMS')

    @override_settings(SMS_ENABLED=False)
    def test_channel_falls_back_to_email_when_the_text_cannot_go(self):
        notification, delivery = notify(
            make_student(), category='Deadline', title='t', body='b',
            sms_text='text', email=True)

        self.assertEqual(delivery.sms.status, 'Skipped')
        self.assertEqual(delivery.email.status, 'Sent')
        self.assertEqual(notification.channel, 'Email')

    @override_settings(SMS_ENABLED=False, EMAIL_ENABLED=False)
    def test_channel_stays_system_when_nothing_delivered(self):
        notification, _ = notify(
            make_student(), category='Deadline', title='t', body='b',
            sms_text='text', email=True)
        self.assertEqual(notification.channel, 'System')

    @override_settings(SMS_ENABLED=False, EMAIL_ENABLED=False)
    def test_student_still_gets_the_in_app_alert_when_both_channels_are_down(self):
        notify(make_student(), category='Deadline', title='t', body='b',
               sms_text='x', email=True)
        self.assertEqual(Notification.objects.count(), 1)

    def test_nothing_is_delivered_unless_asked_for(self):
        notification, delivery = notify(
            make_student(), category='Status', title='t', body='b')

        self.assertIsNone(delivery.sms)
        self.assertIsNone(delivery.email)
        self.assertEqual(notification.channel, 'System')
        self.assertEqual(OutboundMessage.objects.count(), 0)


class ArkeselBackendTests(TestCase):
    """The SMS gateway contract, exercised without touching the network."""

    def _backend(self, **kwargs):
        kwargs.setdefault('api_key', 'k')
        kwargs.setdefault('sender_id', 'ScholarGH')
        kwargs.setdefault('timeout', 5)
        return ArkeselSmsBackend(**kwargs)

    def test_success_with_data_as_an_object(self):
        with patch('requests.post', return_value=fake_response(
                payload={'status': 'success', 'data': {'id': 'msg_1'}})):
            result = self._backend().send('+233244123456', 'hi')

        self.assertTrue(result.ok)
        self.assertEqual(result.provider_message_id, 'msg_1')

    def test_success_with_data_as_a_per_recipient_list(self):
        with patch('requests.post', return_value=fake_response(
                payload={'status': 'success', 'data': [{'id': 'msg_2'}]})):
            result = self._backend().send('+233244123456', 'hi')

        self.assertTrue(result.ok)
        self.assertEqual(result.provider_message_id, 'msg_2')

    def test_number_goes_on_the_wire_without_the_plus(self):
        with patch('requests.post', return_value=fake_response(
                payload={'status': 'success', 'data': {'id': 'x'}})) as post:
            self._backend().send('+233244123456', 'hi')

        self.assertEqual(post.call_args.kwargs['json']['recipients'], ['233244123456'])
        self.assertEqual(post.call_args.kwargs['headers']['api-key'], 'k')

    def test_http_error_is_a_failure_not_an_exception(self):
        with patch('requests.post', return_value=fake_response(
                status_code=422, text='sender id not registered')):
            result = self._backend().send('+233244123456', 'hi')

        self.assertFalse(result.ok)
        self.assertIn('422', result.error)

    def test_network_failure_is_caught(self):
        with patch('requests.post', side_effect=OSError('connection reset')):
            result = self._backend().send('+233244123456', 'hi')

        self.assertFalse(result.ok)
        self.assertIn('connection reset', result.error)

    def test_missing_api_key_fails_before_any_request(self):
        with patch('requests.post') as post:
            result = self._backend(api_key='').send('+233244123456', 'hi')

        self.assertFalse(result.ok)
        post.assert_not_called()


class BrevoBackendTests(TestCase):
    """The email provider contract, exercised without touching the network."""

    def _backend(self, **kwargs):
        kwargs.setdefault('api_key', 'k')
        kwargs.setdefault('sender_email', 'sender@example.com')
        kwargs.setdefault('sender_name', 'ScholarCircle')
        kwargs.setdefault('timeout', 5)
        return BrevoEmailBackend(**kwargs)

    def test_created_response_carries_the_message_id(self):
        with patch('requests.post', return_value=fake_response(
                status_code=201, payload={'messageId': '<abc@brevo>'})):
            result = self._backend().send('a@b.com', 'Subject', 'Body')

        self.assertTrue(result.ok)
        self.assertEqual(result.provider_message_id, '<abc@brevo>')

    def test_payload_matches_the_documented_shape(self):
        with patch('requests.post', return_value=fake_response(
                status_code=201, payload={'messageId': 'x'})) as post:
            self._backend().send('a@b.com', 'Subject', 'Body', to_name='Ama Mensah')

        sent = post.call_args.kwargs['json']
        self.assertEqual(sent['sender'], {'email': 'sender@example.com',
                                          'name': 'ScholarCircle'})
        self.assertEqual(sent['to'], [{'email': 'a@b.com', 'name': 'Ama Mensah'}])
        self.assertEqual(sent['subject'], 'Subject')
        # Both parts go out: HTML-only mail scores badly with spam filters.
        self.assertIn('Body', sent['textContent'])
        self.assertIn('Body', sent['htmlContent'])
        self.assertEqual(post.call_args.kwargs['headers']['api-key'], 'k')

    def test_unverified_sender_is_a_failure_not_an_exception(self):
        with patch('requests.post', return_value=fake_response(
                status_code=400, text='sender not valid')):
            result = self._backend().send('a@b.com', 'S', 'B')

        self.assertFalse(result.ok)
        self.assertIn('400', result.error)

    def test_network_failure_is_caught(self):
        with patch('requests.post', side_effect=OSError('connection reset')):
            result = self._backend().send('a@b.com', 'S', 'B')

        self.assertFalse(result.ok)
        self.assertIn('connection reset', result.error)

    def test_missing_credentials_fail_before_any_request(self):
        for kwargs in ({'api_key': ''}, {'sender_email': ''}):
            with self.subTest(**kwargs), patch('requests.post') as post:
                result = self._backend(**kwargs).send('a@b.com', 'S', 'B')
                self.assertFalse(result.ok)
                post.assert_not_called()

    def test_accepted_body_without_an_id_still_counts_as_sent(self):
        with patch('requests.post', return_value=fake_response(status_code=201, text='ok')):
            result = self._backend().send('a@b.com', 'S', 'B')
        self.assertTrue(result.ok)

    def test_html_escapes_the_body(self):
        markup = render_html('Subject', 'Bell & Co <script>alert(1)</script>')
        self.assertIn('&amp;', markup)
        self.assertNotIn('<script>', markup)


@override_settings(**DELIVERY_SETTINGS)
class DeadlineReminderCommandTests(TestCase):
    def setUp(self):
        self.student = make_student()
        self.scholarship = make_scholarship()

    def _sms(self):
        return OutboundMessage.objects.get(channel='SMS')

    def test_a_draft_application_is_chased_on_both_channels(self):
        Application.objects.create(
            student=self.student, scholarship=self.scholarship, status='Draft')
        call_command('send_deadline_reminders')

        self.assertEqual(OutboundMessage.objects.filter(status='Sent').count(), 2)
        self.assertIn('still a draft', self._sms().body)
        self.assertLessEqual(len(self._sms().body), 160)

    def test_a_strong_match_with_no_application_is_nudged(self):
        MatchResult.objects.create(
            student=self.student, scholarship=self.scholarship,
            score=88, status='Strong match')
        call_command('send_deadline_reminders')

        self.assertIn('strong match', self._sms().body)

    def test_a_partial_match_is_left_alone(self):
        """Unverified scholarships cap at Partial, so a reminder would be a
        claim the matching engine itself will not make."""
        MatchResult.objects.create(
            student=self.student, scholarship=self.scholarship,
            score=55, status='Partial match')
        call_command('send_deadline_reminders')

        self.assertEqual(OutboundMessage.objects.count(), 0)

    def test_a_submitted_application_is_not_nagged(self):
        Application.objects.create(
            student=self.student, scholarship=self.scholarship, status='Submitted')
        MatchResult.objects.create(
            student=self.student, scholarship=self.scholarship,
            score=88, status='Strong match')
        call_command('send_deadline_reminders')

        self.assertEqual(OutboundMessage.objects.count(), 0)

    def test_a_deadline_outside_every_window_is_ignored(self):
        self.scholarship.deadline = timezone.localdate() + timedelta(days=5)
        self.scholarship.save(update_fields=['deadline'])
        Application.objects.create(
            student=self.student, scholarship=self.scholarship, status='Draft')
        call_command('send_deadline_reminders')

        self.assertEqual(OutboundMessage.objects.count(), 0)

    def test_the_daily_rerun_does_not_message_twice(self):
        Application.objects.create(
            student=self.student, scholarship=self.scholarship, status='Draft')
        call_command('send_deadline_reminders')
        call_command('send_deadline_reminders')

        self.assertEqual(OutboundMessage.objects.count(), 2)  # one per channel

    def test_dry_run_sends_nothing(self):
        Application.objects.create(
            student=self.student, scholarship=self.scholarship, status='Draft')
        call_command('send_deadline_reminders', '--dry-run')

        self.assertEqual(OutboundMessage.objects.count(), 0)
        self.assertEqual(Notification.objects.count(), 0)


@override_settings(**DELIVERY_SETTINGS)
class NewMatchCommandTests(TestCase):
    def setUp(self):
        self.student = make_student()
        self.scholarship = make_scholarship()

    def _strong(self, scholarship, score=90):
        return MatchResult.objects.create(
            student=self.student, scholarship=scholarship,
            score=score, status='Strong match')

    def test_a_new_strong_match_is_announced_once(self):
        self._strong(self.scholarship)
        call_command('notify_new_matches')
        call_command('notify_new_matches')

        self.assertEqual(OutboundMessage.objects.filter(status='Sent').count(), 2)
        self.assertIn('strong match',
                      OutboundMessage.objects.get(channel='SMS').body)

    def test_mark_only_claims_the_backlog_on_every_channel(self):
        """The first deploy must not message everyone about every existing match."""
        self._strong(self.scholarship)
        call_command('notify_new_matches', '--mark-only')

        self.assertEqual(OutboundMessage.objects.filter(status='Skipped').count(), 2)

        call_command('notify_new_matches')
        self.assertEqual(OutboundMessage.objects.filter(status='Sent').count(), 0)

    def test_a_scrape_landing_many_matches_does_not_flood_one_student(self):
        for index in range(4):
            self._strong(make_scholarship(slug=f'award-{index}'), score=90 - index)
        call_command('notify_new_matches', '--max-per-student', '2')

        self.assertEqual(
            OutboundMessage.objects.filter(channel='SMS', status='Sent').count(), 2)

    def test_partial_matches_are_never_announced(self):
        MatchResult.objects.create(
            student=self.student, scholarship=self.scholarship,
            score=50, status='Partial match')
        call_command('notify_new_matches')

        self.assertEqual(OutboundMessage.objects.count(), 0)


class DeploymentCheckTests(TestCase):
    """The deploy-time warnings.

    These only fire on a deployed environment, which means the suite is the
    only place they are ever exercised. Without these tests the check could rot
    silently and nobody would find out until a deploy sent nothing.
    """

    def _ids(self, **overrides):
        settings_kwargs = dict(
            SMS_BACKEND='console', ARKESEL_API_KEY='', ARKESEL_SENDER_ID='ScholarCirc',
            EMAIL_PROVIDER='console', BREVO_API_KEY='', BREVO_SENDER_EMAIL='')
        settings_kwargs.update(overrides)
        with override_settings(**settings_kwargs):
            with patch('core.checks.looks_like_production', return_value=True):
                return {w.id for w in delivery_backends_are_configured(None)}

    def test_silent_off_a_deployed_environment(self):
        with patch('core.checks.looks_like_production', return_value=False):
            self.assertEqual(delivery_backends_are_configured(None), [])

    def test_console_backends_in_production_are_flagged(self):
        """Console reports Sent, so this is the warning that matters most."""
        self.assertEqual(self._ids(), {'core.W001', 'core.W004'})

    def test_real_providers_with_no_credentials_are_flagged(self):
        self.assertEqual(
            self._ids(SMS_BACKEND='arkesel', EMAIL_PROVIDER='brevo'),
            {'core.W002', 'core.W005', 'core.W006'})

    def test_oversized_sender_id_is_flagged(self):
        self.assertIn('core.W003', self._ids(ARKESEL_SENDER_ID='ScholarCircle'))

    def test_fully_configured_deployment_is_clean(self):
        self.assertEqual(
            self._ids(SMS_BACKEND='arkesel', ARKESEL_API_KEY='k',
                      EMAIL_PROVIDER='brevo', BREVO_API_KEY='k',
                      BREVO_SENDER_EMAIL='alerts@example.com'),
            set())
