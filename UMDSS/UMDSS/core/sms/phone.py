"""Ghana phone numbers to E.164, defensively.

Nothing validates ``StudentProfile.phone`` on the way in. The register form
carries an HTML ``pattern`` attribute, which is client-side only, and the
settings form does not even have that; the serializer accepts any string. So
the column holds whatever people typed: spaces, dashes, a stray ``+``, a
leading zero or not.

Every send goes through :func:`to_e164` first. A number it cannot vouch for
comes back as ``None`` and is skipped rather than handed to the gateway,
because a send that fails at the network still costs a credit.
"""

import re

COUNTRY_CODE = '233'

# National (0XX) mobile prefixes in use in Ghana, across MTN, Telecel,
# AirtelTigo and Glo. Fixed lines (03X) are deliberately absent: an SMS to one
# is billed and then dropped.
MOBILE_PREFIXES = frozenset({
    '20', '23', '24', '25', '26', '27', '28', '29',
    '50', '53', '54', '55', '56', '57', '59',
})

_NON_DIGITS = re.compile(r'\D')


def to_e164(raw):
    """Return ``+233XXXXXXXXX``, or ``None`` if this is not a sendable mobile.

    ``None`` is the answer for anything doubtful — an empty column, a landline,
    a truncated number — so callers can skip the recipient without spending.
    """
    if not raw:
        return None

    digits = _NON_DIGITS.sub('', str(raw))
    if not digits:
        return None

    # Read the digits every way that could be right, then take the first that
    # lands on nine digits behind a known mobile prefix. Trying the readings
    # rather than branching on the first match is what keeps a Glo number typed
    # without its leading zero (233xxxxxx) from being misread as a country code
    # followed by six digits.
    candidates = [
        digits[len(prefix):]
        for prefix in ('00' + COUNTRY_CODE, COUNTRY_CODE, '0')
        if digits.startswith(prefix)
    ]
    candidates.append(digits)

    for national in candidates:
        if len(national) == 9 and national[:2] in MOBILE_PREFIXES:
            return f'+{COUNTRY_CODE}{national}'
    return None


def for_wire(e164):
    """Strip the ``+`` for gateways that want a bare international number.

    Arkesel's own material is inconsistent here — the developer guide shows
    ``233XXXXXXXXX`` while the product page shows ``+233244000000``. Bare digits
    are accepted in both readings, so that is what goes on the wire. If a live
    send ever disagrees, this one function is the only thing that changes.
    """
    return e164.lstrip('+')
