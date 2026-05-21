# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import re

# Django imports
from django.db.models import Q

# Module imports

# Matches short-id mention patterns like "PIPE-7" or "ENG-120". Project
# identifiers in Plane are uppercase ASCII letters; sequence_id is an
# integer. Anchored with word boundaries so it can be lifted out of a
# longer query string (e.g. "@PIPE-7 status?").
_SHORT_ID_PATTERN = re.compile(r"\b([A-Z][A-Z0-9]*)-(\d+)\b")


def search_issues(query, queryset):
    """Filter ``queryset`` (a queryset of Issue) by ``query``.

    Behaviour:
    - If the query contains a short-id pattern (e.g. ``PIPE-7``), prefer that
      exact project_identifier + sequence_id match. This gives ``@PIPE-7``
      mention typeahead a clean exact hit instead of fuzzy fallbacks.
    - Otherwise fall back to the original substring search across
      ``name``, ``sequence_id`` (numeric tokens), and ``project__identifier``.
    """
    short_id_matches = _SHORT_ID_PATTERN.findall(query) if query else []
    if short_id_matches:
        short_id_q = Q()
        for identifier, sequence_id in short_id_matches:
            short_id_q |= Q(
                project__identifier__iexact=identifier,
                sequence_id=int(sequence_id),
            )
        exact = queryset.filter(short_id_q).distinct()
        # Short-id pattern is unambiguous — return the exact match set if we
        # found anything; otherwise fall through to the fuzzy search so the
        # caller still gets some signal.
        if exact.exists():
            return exact

    fields = ["name", "sequence_id", "project__identifier"]
    q = Q()
    for field in fields:
        if field == "sequence_id" and len(query) <= 20:
            sequences = re.findall(r"\b\d+\b", query)
            for sequence_id in sequences:
                q |= Q(**{"sequence_id": sequence_id})
        else:
            q |= Q(**{f"{field}__icontains": query})
    return queryset.filter(q).distinct()
