# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the Issue linked-pages reverse-lookup endpoint.

Endpoint under test:
    GET /api/v1/workspaces/<slug>/projects/<project_id>/issues/<issue_id>/linked-pages/
    GET /api/v1/workspaces/<slug>/projects/<project_id>/work-items/<issue_id>/linked-pages/

The endpoint mirrors the reverse-lookup that PageLog already supports
(entity_name="issue", entity_identifier=<issue_uuid>) — see ENG-120 / Phase 8.

These tests bypass the page_transaction Celery task (which is what populates
PageLog from page description_html on save) and write the PageLog rows
directly. The Celery hop is covered by upstream Plane's own tests; the new
piece is the API surface that surfaces those rows.
"""
import pytest
from unittest import mock
from rest_framework import status
from rest_framework.test import APIClient
from uuid import uuid4

from plane.db.models import (
    Issue,
    Page,
    PageLog,
    Project,
    ProjectMember,
    ProjectPage,
    State,
    User,
    Workspace,
    WorkspaceMember,
)
from plane.db.models.api import APIToken


@pytest.fixture(autouse=True)
def _stub_page_transaction_celery():
    """The Pages API now dispatches page_transaction.delay() via
    ``transaction.on_commit`` — under default ``django_db`` the callback
    never fires (transaction rolls back), so this is a belt-and-braces
    stub for any test that promotes to ``transaction=True`` and forgets
    its own ``mock.patch``."""
    with mock.patch(
        "plane.api.views.page.page_transaction.delay",
        return_value=None,
    ):
        yield


@pytest.fixture
def project(db, workspace, create_user):
    """Project with the user as admin."""
    project = Project.objects.create(
        name="Test Project",
        identifier="TP",
        workspace=workspace,
        created_by=create_user,
    )
    ProjectMember.objects.create(
        project=project,
        member=create_user,
        role=20,
        is_active=True,
    )
    return project


@pytest.fixture
def state(db, workspace, project, create_user):
    return State.objects.create(
        name="Backlog",
        workspace=workspace,
        project=project,
        group="backlog",
        default=True,
        created_by=create_user,
    )


@pytest.fixture
def issue(db, workspace, project, state, create_user):
    return Issue.objects.create(
        name="Test Issue",
        workspace=workspace,
        project=project,
        state=state,
        created_by=create_user,
    )


@pytest.fixture
def linked_page(db, workspace, project, issue, create_user):
    """Create a page attached to ``project`` with a PageLog row pointing
    at ``issue`` — the exact substrate the endpoint surfaces."""
    page = Page.objects.create(
        name="Decision log",
        description_html='<p><mention-component entity_name="issue" entity_identifier="%s"></mention-component></p>'
        % str(issue.id),
        workspace=workspace,
        owned_by=create_user,
        created_by=create_user,
    )
    ProjectPage.objects.create(
        project=project,
        page=page,
        workspace=workspace,
        created_by=create_user,
    )
    PageLog.objects.create(
        transaction=uuid4(),
        page=page,
        entity_identifier=issue.id,
        entity_name="issue",
        workspace=workspace,
        created_by=create_user,
    )
    return page


def _linked_pages_url(slug, project_id, issue_id, prefix="issues"):
    """Build the linked-pages URL on either the deprecated ``/issues/``
    prefix or the new ``/work-items/`` prefix."""
    return f"/api/v1/workspaces/{slug}/projects/{project_id}/{prefix}/{issue_id}/linked-pages/"


@pytest.mark.contract
class TestIssueLinkedPagesAPIEndpoint:
    """Reverse-lookup: which pages mention this issue?"""

    @pytest.mark.django_db
    def test_returns_pages_that_mention_issue(
        self, api_key_client, workspace, project, issue, linked_page
    ):
        url = _linked_pages_url(workspace.slug, project.id, issue.id)
        response = api_key_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, list)
        ids = [str(p["id"]) for p in response.data]
        assert str(linked_page.id) in ids
        # Shape: minimal payload, no description_html bloat
        first = response.data[0]
        assert "name" in first
        assert "project_id" in first
        assert "description_html" not in first

    @pytest.mark.django_db
    def test_returns_empty_when_no_mentions(self, api_key_client, workspace, project, issue):
        url = _linked_pages_url(workspace.slug, project.id, issue.id)
        response = api_key_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    @pytest.mark.django_db
    def test_excludes_other_project_pages(
        self, api_key_client, workspace, project, issue, create_user
    ):
        """A PageLog row pointing at this issue from a page attached to
        a different project must NOT leak into this project's result."""
        other_project = Project.objects.create(
            name="Other Project",
            identifier="OP",
            workspace=workspace,
            created_by=create_user,
        )
        ProjectMember.objects.create(
            project=other_project, member=create_user, role=20, is_active=True
        )
        other_page = Page.objects.create(
            name="Other-project page",
            workspace=workspace,
            owned_by=create_user,
        )
        ProjectPage.objects.create(
            project=other_project, page=other_page, workspace=workspace
        )
        PageLog.objects.create(
            transaction=uuid4(),
            page=other_page,
            entity_identifier=issue.id,
            entity_name="issue",
            workspace=workspace,
        )

        url = _linked_pages_url(workspace.slug, project.id, issue.id)
        response = api_key_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        ids = [str(p["id"]) for p in response.data]
        assert str(other_page.id) not in ids

    @pytest.mark.django_db
    def test_excludes_non_issue_entity_types(
        self, api_key_client, workspace, project, issue, create_user
    ):
        """PageLog rows for image, link, page_mention, etc. must not be
        returned by the issue-linked-pages lookup."""
        page = Page.objects.create(
            name="Mixed-mentions page", workspace=workspace, owned_by=create_user
        )
        ProjectPage.objects.create(project=project, page=page, workspace=workspace)
        # Decoy: matches the entity_identifier but wrong entity_name
        PageLog.objects.create(
            transaction=uuid4(),
            page=page,
            entity_identifier=issue.id,
            entity_name="image",
            workspace=workspace,
        )
        url = _linked_pages_url(workspace.slug, project.id, issue.id)
        response = api_key_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        ids = [str(p["id"]) for p in response.data]
        assert str(page.id) not in ids

    @pytest.mark.django_db
    def test_unknown_issue_returns_404(self, api_key_client, workspace, project):
        url = _linked_pages_url(workspace.slug, project.id, uuid4())
        response = api_key_client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.django_db
    def test_works_on_work_items_url_prefix(
        self, api_key_client, workspace, project, issue, linked_page
    ):
        """Both old (/issues/) and new (/work-items/) URL prefixes resolve."""
        url = _linked_pages_url(
            workspace.slug, project.id, issue.id, prefix="work-items"
        )
        response = api_key_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        ids = [str(p["id"]) for p in response.data]
        assert str(linked_page.id) in ids

    @pytest.mark.django_db
    def test_no_api_key_returns_401(self, workspace, project, issue):
        url = _linked_pages_url(workspace.slug, project.id, issue.id)
        unauth = APIClient()
        response = unauth.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.django_db
    def test_other_workspace_api_key_is_isolated(
        self, db, workspace, project, issue, linked_page
    ):
        """An API key belonging to a different workspace cannot read this
        workspace's linked-pages."""
        other_user = User.objects.create(
            email="other@plane.so",
            username=f"other-{uuid4().hex[:8]}",
        )
        other_user.set_password("pw")
        other_user.save()
        other_workspace = Workspace.objects.create(
            name="Other", owner=other_user, slug="other-ws"
        )
        WorkspaceMember.objects.create(
            workspace=other_workspace, member=other_user, role=20
        )
        other_token = APIToken.objects.create(
            user=other_user, label="other-tok", token="other-api-key-9999"
        )

        client = APIClient()
        client.credentials(HTTP_X_API_KEY=other_token.token)
        url = _linked_pages_url(workspace.slug, project.id, issue.id)
        response = client.get(url)
        assert response.status_code in (
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
        )


@pytest.mark.contract
class TestPagesAPIPopulatesPageLog:
    """Phase 8 AC #2: Pages created/updated via the public API must
    populate PageLog — i.e. page_transaction.delay() is invoked with the
    right description_html on every write."""

    @pytest.mark.django_db(transaction=True)
    def test_create_page_dispatches_page_transaction(
        self, api_key_client, workspace, project, issue
    ):
        """POST /pages/ schedules a page_transaction task with new_description_html
        equal to the request body. Uses ``transaction=True`` so the
        ``transaction.on_commit`` callback that schedules the dispatch
        actually fires (default django_db rolls back and suppresses it)."""
        with mock.patch(
            "plane.api.views.page.page_transaction.delay"
        ) as page_tx_mock:
            url = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/pages/"
            description = (
                '<p><mention-component entity_name="issue" '
                'entity_identifier="%s" id="%s"></mention-component></p>'
            ) % (str(issue.id), str(uuid4()))
            response = api_key_client.post(
                url,
                {"name": "Page with mention", "description_html": description},
                format="json",
            )
            assert response.status_code == status.HTTP_201_CREATED
            page_tx_mock.assert_called_once()
            call_kwargs = page_tx_mock.call_args.kwargs
            assert call_kwargs["old_description_html"] is None
            assert "mention-component" in call_kwargs["new_description_html"]

    @pytest.mark.django_db(transaction=True)
    def test_patch_page_dispatches_page_transaction(
        self, api_key_client, workspace, project, issue, create_user
    ):
        """PATCH /pages/<id>/ with description_html schedules a transaction
        with both old + new HTML so the diff can be computed."""
        page = Page.objects.create(
            name="Existing", workspace=workspace, owned_by=create_user
        )
        ProjectPage.objects.create(project=project, page=page, workspace=workspace)

        with mock.patch(
            "plane.api.views.page.page_transaction.delay"
        ) as page_tx_mock:
            url = (
                f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/pages/{page.id}/"
            )
            new_html = (
                '<p><mention-component entity_name="issue" '
                'entity_identifier="%s" id="%s"></mention-component></p>'
            ) % (str(issue.id), str(uuid4()))
            response = api_key_client.patch(
                url, {"description_html": new_html}, format="json"
            )
            assert response.status_code == status.HTTP_200_OK
            page_tx_mock.assert_called_once()
            call_kwargs = page_tx_mock.call_args.kwargs
            assert "mention-component" in call_kwargs["new_description_html"]
            assert str(page.id) == call_kwargs["page_id"]

    @pytest.mark.django_db(transaction=True)
    def test_patch_page_without_description_does_not_dispatch(
        self, api_key_client, workspace, project, create_user
    ):
        """PATCHing only the name doesn't fire the diff — matches the
        internal viewset behaviour."""
        page = Page.objects.create(
            name="Old name", workspace=workspace, owned_by=create_user
        )
        ProjectPage.objects.create(project=project, page=page, workspace=workspace)

        with mock.patch(
            "plane.api.views.page.page_transaction.delay"
        ) as page_tx_mock:
            url = (
                f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/pages/{page.id}/"
            )
            response = api_key_client.patch(url, {"name": "New name"}, format="json")
            assert response.status_code == status.HTTP_200_OK
            page_tx_mock.assert_not_called()

    @pytest.mark.django_db(transaction=True)
    def test_create_page_absorbs_broker_failure(
        self, api_key_client, workspace, project
    ):
        """If the Celery broker is down, on_commit(robust=True) swallows the
        error — the response remains 201 and the page is still created."""
        with mock.patch("plane.api.views.page.page_transaction") as page_tx_mock:
            page_tx_mock.delay.side_effect = RuntimeError("broker unavailable")
            url = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/pages/"
            response = api_key_client.post(
                url,
                {"name": "Even with broker down", "description_html": "<p>hi</p>"},
                format="json",
            )
            assert response.status_code == status.HTTP_201_CREATED
            page_tx_mock.delay.assert_called_once()


@pytest.mark.contract
class TestShortIdSearch:
    """Phase 8 AC: ``search_issues`` must short-circuit on ``<IDENT>-<N>``
    patterns so ``@PIPE-7`` mention typeahead lands on the exact issue."""

    @pytest.mark.django_db
    def test_short_id_exact_match_preferred(self, db, workspace, create_user):
        """``search_issues("PIPE-7", qs)`` returns the exact PIPE-7 issue
        even when a fuzzier match (e.g. sequence_id=7 in another project)
        would also overlap. ``Issue.save()`` auto-assigns sequence_id from
        the project's IssueSequence counter, so we create N issues per
        project to land the target sequence."""
        from plane.utils.issue_search import search_issues

        pipe_project = Project.objects.create(
            name="Pipeline",
            identifier="PIPE",
            workspace=workspace,
            created_by=create_user,
        )
        eng_project = Project.objects.create(
            name="Engineering",
            identifier="ENG",
            workspace=workspace,
            created_by=create_user,
        )
        pipe_state = State.objects.create(
            name="Backlog",
            workspace=workspace,
            project=pipe_project,
            group="backlog",
            default=True,
        )
        eng_state = State.objects.create(
            name="Backlog",
            workspace=workspace,
            project=eng_project,
            group="backlog",
            default=True,
        )

        pipe_7 = None
        for n in range(7):
            issue = Issue.objects.create(
                name=f"Pipeline issue {n + 1}",
                workspace=workspace,
                project=pipe_project,
                state=pipe_state,
            )
            if issue.sequence_id == 7:
                pipe_7 = issue
        assert pipe_7 is not None, "expected a sequence_id=7 issue in PIPE"

        # Decoy ENG-7 — same sequence_id, different project. Without the
        # short-id fast-path the fuzzy fallback would surface both.
        for n in range(7):
            Issue.objects.create(
                name=f"Engineering issue {n + 1}",
                workspace=workspace,
                project=eng_project,
                state=eng_state,
            )

        results = search_issues("PIPE-7", Issue.issue_objects.all())
        assert pipe_7 in results
        # Exactly one match — fuzzy fallback should NOT fire because the
        # exact short-id path succeeded.
        assert results.count() == 1

    @pytest.mark.django_db
    def test_short_id_fuzzy_fallback_when_no_match(self, db, workspace, create_user):
        """If the short-id has no exact hit, fall back to fuzzy search
        so the caller still gets matches on name / sequence_id."""
        from plane.utils.issue_search import search_issues

        project = Project.objects.create(
            name="Engineering",
            identifier="ENG",
            workspace=workspace,
            created_by=create_user,
        )
        state = State.objects.create(
            name="Backlog",
            workspace=workspace,
            project=project,
            group="backlog",
            default=True,
        )
        # No ENG-999 exists, but a name-substring hit should still come back
        named = Issue.objects.create(
            name="Mentions ENG-999 in the body",
            workspace=workspace,
            project=project,
            state=state,
        )
        results = search_issues("ENG-999", Issue.issue_objects.all())
        assert named in results
