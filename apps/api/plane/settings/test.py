# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Test Settings"""

from .common import *  # noqa

DEBUG = True

# Send it in a dummy outbox
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# [ours: contract-tests] ENG-141 — run Celery tasks synchronously under tests.
# Several contract tests previously needed per-file shims (mock.patch on
# soft_delete_related_objects.delay, page_transaction.delay) because the
# default broker URL is unreachable inside the test runner. CELERY_TASK_ALWAYS_EAGER
# + CELERY_TASK_EAGER_PROPAGATES executes .delay() inline (same process,
# same thread), so tests get real task execution without a broker. Tests
# that still want to assert dispatch shape (e.g. test_linked_pages) use
# mock.patch on the specific task path — that continues to work because
# mock.patch intercepts before the eager dispatch.
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

INSTALLED_APPS.append(  # noqa
    "plane.tests"
)
