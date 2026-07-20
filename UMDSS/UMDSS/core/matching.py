"""Eligibility matching between a student profile and a scholarship.

Produces the score/status/criteria triple that MatchResult stores and the UI
renders. Kept as pure functions so the rules can be tested without a database.

Design notes:
  * Students come in two tracks — SHS (in school or completed, heading for
    tertiary) and University (enrolled). Scholarships carry a `level_scope`
    saying who they fund. Level is a hard gate: a postgraduate award is simply
    'Not eligible' for an SHS student, not a weak match.
  * The WASSCE aggregate is a hard gate where known. In Ghana a *lower*
    aggregate is better (6 is the best possible), so a student qualifies when
    their aggregate is <= the scholarship's `max_aggregate` ceiling. A null
    aggregate (SHS student awaiting results, or an incomplete profile) is
    treated as *unknown*, not as failure — the match is capped at Partial with
    a criterion telling the student what to add.
  * Several situations cap a match at Partial because we cannot honestly claim
    more: a curated (unverified fallback) listing, a scholarship with no
    published criteria, an unclassified level scope, an incomplete profile, or
    a missing aggregate. Only a live-scraped listing with real criteria matched
    against a complete profile can reach "Strong match".
"""

# Weights sum to 100. The aggregate dominates because it is the gate that most
# often decides eligibility in practice.
WEIGHT_AGGREGATE = 40
WEIGHT_PROGRAMME = 25
WEIGHT_REGION = 20
WEIGHT_NEED = 15

STRONG_MATCH_THRESHOLD = 85

# The scraper's default when a source page publishes no aggregate requirement.
DEFAULT_MAX_AGGREGATE = 36


def _open_to_all(values) -> bool:
    """True when a list field means 'no restriction'."""
    if not values:
        return True
    return any(str(v).strip().lower() == 'all' for v in values)


def _matches_any(value: str, options) -> bool:
    """Loose containment both ways.

    Profile values and scraped values rarely agree exactly — a profile says
    'BSc Computer Engineering' where a scholarship says 'Computer Engineering'.
    """
    if not value:
        return False
    v = value.strip().lower()
    for opt in options:
        o = str(opt).strip().lower()
        if not o:
            continue
        if v == o or o in v or v in o:
            return True
    return False


def has_published_criteria(scholarship) -> bool:
    """False when the scholarship carries none of its own eligibility data."""
    return not (
        scholarship.max_aggregate == DEFAULT_MAX_AGGREGATE
        and _open_to_all(scholarship.region)
        and _open_to_all(scholarship.programmes)
    )


def eligible_scopes(profile):
    """The scholarship level_scopes this student can apply for, or None if the
    profile is too incomplete to say."""
    if profile.student_type == 'SHS':
        # SHS bursaries, and tertiary funding they can enter with.
        return {'shs', 'tertiary_entry', 'tertiary_any'}
    if profile.student_type == 'University':
        if profile.university_level == 'Postgraduate':
            return {'postgraduate'}
        if profile.university_level == '100':
            # Freshers can still take entry awards (most Ghanaian entry
            # scholarships are applied for after admission).
            return {'tertiary_entry', 'tertiary_continuing', 'tertiary_any'}
        return {'tertiary_continuing', 'tertiary_any'}
    return None


def compute_match(profile, scholarship) -> dict:
    """Return {'score', 'status', 'criteria'} for one profile/scholarship pair."""
    criteria = []
    score = 0
    # Reasons the match cannot honestly be called Strong, even if every scored
    # criterion passes.
    capped = False
    hard_fail = False

    # ── Student level vs award scope (hard gate) ──────
    scopes = eligible_scopes(profile)
    if scopes is None:
        criteria.append({
            'label': 'Student level',
            'met': False,
            'detail': 'Complete your profile so we can confirm which awards fit your level',
        })
        capped = True
    elif scholarship.level_scope == 'unknown':
        criteria.append({
            'label': 'Student level',
            'met': False,
            'detail': 'The provider does not state which students this is for — confirm before applying',
        })
        capped = True
    elif scholarship.level_scope in scopes:
        criteria.append({
            'label': 'Student level',
            'met': True,
            'detail': scholarship.get_level_scope_display(),
        })
    else:
        criteria.append({
            'label': 'Student level',
            'met': False,
            'detail': f'This award is for: {scholarship.get_level_scope_display().lower()}',
        })
        hard_fail = True

    # ── WASSCE aggregate ──────────────────────────────
    aggregate = profile.wassce_aggregate
    if aggregate is None:
        if profile.student_type == 'SHS' and profile.wassce_status in ('not_written', 'awaiting'):
            detail = 'Add your WASSCE results when they are released to confirm eligibility'
        else:
            detail = 'Add your WASSCE aggregate to your profile to confirm eligibility'
        criteria.append({'label': 'WASSCE aggregate', 'met': False, 'detail': detail})
        capped = True
    else:
        aggregate_met = aggregate <= scholarship.max_aggregate
        if scholarship.max_aggregate == DEFAULT_MAX_AGGREGATE:
            detail = 'No aggregate requirement published by the provider'
        elif aggregate_met:
            detail = f'Your aggregate {aggregate} is within the required ≤ {scholarship.max_aggregate}'
        else:
            detail = f'Your aggregate {aggregate} does not meet the required ≤ {scholarship.max_aggregate}'
        criteria.append({'label': 'WASSCE aggregate', 'met': aggregate_met, 'detail': detail})
        if aggregate_met:
            score += WEIGHT_AGGREGATE
        else:
            hard_fail = True

    # ── Programme of study ────────────────────────────
    programme_label = (
        'Intended programme' if profile.student_type == 'SHS' else 'Programme of study'
    )
    if _open_to_all(scholarship.programmes):
        programme_met, programme_detail = True, 'Open to all programmes'
    elif _matches_any(profile.programme, scholarship.programmes):
        programme_met = True
        programme_detail = f'{profile.programme} is an eligible programme'
    else:
        programme_met = False
        programme_detail = f'Restricted to {", ".join(scholarship.programmes[:3])}'
    criteria.append({'label': programme_label, 'met': programme_met, 'detail': programme_detail})
    if programme_met:
        score += WEIGHT_PROGRAMME

    # ── Region ────────────────────────────────────────
    if _open_to_all(scholarship.region):
        region_met, region_detail = True, 'Nationwide eligibility'
    elif _matches_any(profile.region, scholarship.region):
        region_met = True
        region_detail = f'{profile.region} is an eligible region'
    else:
        region_met = False
        region_detail = f'Restricted to {", ".join(scholarship.region[:3])}'
    criteria.append({'label': 'Region', 'met': region_met, 'detail': region_detail})
    if region_met:
        score += WEIGHT_REGION

    # ── Financial need ────────────────────────────────
    if not scholarship.need_based:
        need_met, need_detail = True, 'Not a need-based award'
    elif profile.need_level in ('High', 'Moderate'):
        need_met = True
        need_detail = f'{profile.need_level} need level matches the award focus'
    else:
        need_met = False
        need_detail = 'This award prioritises students with demonstrated financial need'
    criteria.append({'label': 'Financial need', 'met': need_met, 'detail': need_detail})
    if need_met:
        score += WEIGHT_NEED

    # ── Honesty caps ──────────────────────────────────
    if scholarship.origin == 'curated':
        # Fallback data that was never confirmed against the provider. It looks
        # complete, which is exactly why it must not present as certain.
        criteria.append({
            'label': 'Listing verified',
            'met': False,
            'detail': 'Could not be confirmed against the provider — criteria may be out of date',
        })
        capped = True
    elif not has_published_criteria(scholarship):
        criteria.append({
            'label': 'Eligibility details',
            'met': False,
            'detail': 'The provider does not publish full criteria here — confirm directly before applying',
        })
        capped = True

    # ── Status ────────────────────────────────────────
    if hard_fail:
        status = 'Not eligible'
    elif capped:
        status = 'Partial match'
        score = min(score, STRONG_MATCH_THRESHOLD - 1)
    elif score >= STRONG_MATCH_THRESHOLD:
        status = 'Strong match'
    else:
        status = 'Partial match'

    return {'score': score, 'status': status, 'criteria': criteria}


# ── Profile completion ────────────────────────────────

def compute_profile_completion(profile) -> int:
    """Percentage of the fields the matcher and application flow actually use."""
    common = [profile.phone, profile.region, profile.home_district, profile.need_level]
    if profile.student_type == 'SHS':
        track = [
            profile.shs_school, profile.shs_level, profile.wassce_status,
            profile.programme,
        ]
        # Aggregate only counts once results exist to be entered.
        if profile.wassce_status == 'released':
            track.append(profile.wassce_aggregate)
    elif profile.student_type == 'University':
        track = [
            profile.institution, profile.programme, profile.university_level,
            profile.academic_standing, profile.wassce_aggregate, profile.student_id,
        ]
    else:
        # No track chosen yet — completion can never exceed the common share.
        track = [None] * 6
    fields = [profile.student_type] + common + track
    filled = sum(1 for f in fields if f not in (None, ''))
    return round(100 * filled / len(fields))


# ── Regeneration ──────────────────────────────────────

def regenerate_matches_for_user(user):
    """Recompute every MatchResult for one user and refresh profile completion.

    Called after profile saves and after scrapes, so match rows never go stale
    against either side of the comparison.
    """
    from .models import MatchResult, Scholarship, StudentProfile

    try:
        profile = user.profile
    except StudentProfile.DoesNotExist:
        return None

    scholarships = list(Scholarship.objects.all())
    for s in scholarships:
        MatchResult.objects.update_or_create(
            student=user, scholarship=s, defaults=compute_match(profile, s),
        )
    MatchResult.objects.filter(student=user).exclude(
        scholarship__in=scholarships
    ).delete()

    completion = compute_profile_completion(profile)
    if completion != profile.profile_completion:
        profile.profile_completion = completion
        profile.save(update_fields=['profile_completion'])
    return completion
